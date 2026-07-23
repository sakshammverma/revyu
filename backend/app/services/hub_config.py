"""One read/write layer for the QR-page (hub) configuration, used by both the
owner (/api/app) and admin (/api/admin) routers so they can never drift."""
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.hub.registry import MODULE_KEYS, MODULES, label_for, module_def
from app.models.hub import MenuCategory, MenuItem, OutletLink, OutletProfile
from app.models.loyalty import LoyaltyBadge, LoyaltyProgram, LoyaltyReward
from app.models.outlet import Outlet
from app.models.referral import OutletModule
from app.services.links import google_maps_url

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class HubConfigError(Exception):
    def __init__(self, code: str, message: str, status: int = 409):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


# ------------------------------------------------------------ modules

def ensure_modules(db: Session, outlet: Outlet) -> list[OutletModule]:
    rows = {m.module: m for m in db.scalars(select(OutletModule).where(OutletModule.outlet_id == outlet.id))}
    changed = False
    for i, mod in enumerate(MODULES):
        if mod.key not in rows:
            row = OutletModule(outlet_id=outlet.id, module=mod.key, enabled=(mod.key == "review"),
                               sort_order=i, available=True)
            db.add(row)
            rows[mod.key] = row
            changed = True
    if changed:
        db.commit()
    return sorted(rows.values(), key=lambda m: m.sort_order)


def active_links(db: Session, outlet: Outlet) -> list[dict]:
    """Owner links plus an automatic Google Maps row from the Places id."""
    links = db.scalars(
        select(OutletLink)
        .where(OutletLink.outlet_id == outlet.id, OutletLink.enabled.is_(True))
        .order_by(OutletLink.sort_order)
    ).all()
    out = [{"id": str(l.id), "kind": l.kind, "label": l.label, "url": l.url} for l in links]
    if outlet.google_place_id and not any(l["kind"] == "google_maps" for l in out):
        out.insert(0, {"id": "auto-maps", "kind": "google_maps", "label": None,
                       "url": google_maps_url(outlet.business_name, outlet.google_place_id),
                       "auto": True})
    return out


def content_reason(db: Session, outlet: Outlet, key: str) -> str | None:
    """None when the module has enough content to be shown; else why not (FR-89)."""
    if key == "review":
        return None
    if key == "connect":
        profile = db.get(OutletProfile, outlet.id)
        if active_links(db, outlet) or (profile and (profile.phone or profile.address_line)):
            return None
        return "Add at least one link, phone number or address."
    if key == "menu":
        n = db.scalar(
            select(func.count()).select_from(MenuItem)
            .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
            .where(MenuCategory.outlet_id == outlet.id, MenuItem.available.is_(True))
        )
        return None if n else "Add at least one item."
    if key == "rewards":
        prog = db.get(LoyaltyProgram, outlet.id)
        if prog is None or prog.acknowledged_at is None:
            return "Read and accept the rewards guidelines first."
        n = db.scalar(
            select(func.count()).select_from(LoyaltyBadge)
            .join(LoyaltyReward, LoyaltyReward.badge_id == LoyaltyBadge.id)
            .where(LoyaltyBadge.outlet_id == outlet.id, LoyaltyBadge.active.is_(True))
        )
        return None if n else "Create at least one badge with a reward."
    return "Unknown module."


def set_modules(db: Session, outlet: Outlet, items: list[dict], *, is_admin: bool = False) -> None:
    rows = {m.module: m for m in ensure_modules(db, outlet)}
    for order, item in enumerate(items):
        key = item["module"]
        if key not in MODULE_KEYS:
            raise HubConfigError("UNKNOWN_MODULE", f"Unknown module {key}", 422)
        row = rows[key]
        if item["enabled"] and not row.enabled:
            if not row.available and not is_admin:
                raise HubConfigError("MODULE_UNAVAILABLE", "This module isn't available for your page yet.")
            reason = content_reason(db, outlet, key)
            if reason:
                raise HubConfigError("MODULE_EMPTY", reason)
        row.enabled = bool(item["enabled"])
        row.sort_order = order
    db.commit()


def set_availability(db: Session, outlet: Outlet, module: str, available: bool) -> None:
    rows = {m.module: m for m in ensure_modules(db, outlet)}
    if module not in rows or module == "review":
        raise HubConfigError("UNKNOWN_MODULE", "Unknown module", 422)
    rows[module].available = available
    if not available:
        rows[module].enabled = False
    db.commit()


# ------------------------------------------------------------ resolution

def resolve_hub(db: Session, outlet: Outlet) -> dict:
    """SRS-20.1: hub_mode, then enabled-module count. Fewer than two shown
    modules always falls back to the review flow (FR-77)."""
    shown = []
    for row in ensure_modules(db, outlet):
        if not (row.enabled and row.available):
            continue
        if content_reason(db, outlet, row.module) is not None:
            continue
        mod = module_def(row.module)
        shown.append({"key": mod.key, "label": label_for(mod.key, outlet.vertical),
                      "blurb": mod.blurb, "icon": mod.icon, "route": mod.route})
    mode = "hub" if (outlet.hub_mode == "menu" and len(shown) >= 2) else "direct"
    return {"mode": mode, "modules": shown}


def open_now(profile: OutletProfile | None, tz_name: str) -> dict | None:
    if profile is None or not profile.hours:
        return None
    try:
        now = datetime.now(ZoneInfo(tz_name))
    except Exception:  # noqa: BLE001 - bad tz string must never break the page
        return None
    today = profile.hours.get(DAYS[now.weekday()]) or []
    minutes = now.hour * 60 + now.minute
    for start, end in today:
        s = int(start[:2]) * 60 + int(start[3:5])
        e = int(end[:2]) * 60 + int(end[3:5])
        if s <= minutes < e:
            return {"open": True, "until": end}
    return {"open": False, "until": None}


def profile_dict(p: OutletProfile | None) -> dict:
    return {
        "tagline": p.tagline if p else None,
        "cover_image_url": p.cover_image_url if p else None,
        "address_line": p.address_line if p else None,
        "locality": p.locality if p else None,
        "phone": p.phone if p else None,
        "hours": p.hours if p else None,
    }


# ------------------------------------------------------------ menu

def menu_tree(db: Session, outlet: Outlet, *, only_available: bool) -> list[dict]:
    cats = db.scalars(
        select(MenuCategory).where(MenuCategory.outlet_id == outlet.id).order_by(MenuCategory.sort_order)
    ).all()
    items = db.scalars(
        select(MenuItem)
        .where(MenuItem.category_id.in_([c.id for c in cats]) if cats else False)
        .order_by(MenuItem.sort_order)
    ).all() if cats else []
    tree = []
    for c in cats:
        its = [i for i in items if i.category_id == c.id and (i.available or not only_available)]
        if only_available and not its:
            continue
        tree.append({
            "id": str(c.id),
            "name": c.name,
            "items": [item_dict(i) for i in its],
        })
    return tree


def item_dict(i: MenuItem) -> dict:
    return {
        "id": str(i.id), "category_id": str(i.category_id), "name": i.name,
        "description": i.description, "amount_minor": i.amount_minor,
        "currency_code": i.currency_code, "price_on_request": i.price_on_request,
        "price_prefix": i.price_prefix, "duration_min": i.duration_min,
        "dietary": list(i.dietary or []), "photo_url": i.photo_url, "available": i.available,
    }


def owned_category(db: Session, outlet: Outlet, category_id: uuid.UUID) -> MenuCategory:
    cat = db.get(MenuCategory, category_id)
    if cat is None or cat.outlet_id != outlet.id:
        raise HubConfigError("NOT_FOUND", "Category not found", 404)
    return cat


def owned_item(db: Session, outlet: Outlet, item_id: uuid.UUID) -> MenuItem:
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HubConfigError("NOT_FOUND", "Item not found", 404)
    owned_category(db, outlet, item.category_id)
    return item


# ------------------------------------------------------------ editor state

def editor_state(db: Session, outlet: Outlet) -> dict:
    profile = db.get(OutletProfile, outlet.id)
    links = db.scalars(
        select(OutletLink).where(OutletLink.outlet_id == outlet.id).order_by(OutletLink.sort_order)
    ).all()
    modules = []
    for row in ensure_modules(db, outlet):
        mod = module_def(row.module)
        modules.append({
            "key": row.module, "label": label_for(row.module, outlet.vertical),
            "enabled": row.enabled, "available": row.available,
            "blocked_reason": None if row.enabled else content_reason(db, outlet, row.module),
        })
    return {
        "slug": outlet.slug,
        "hub_mode": outlet.hub_mode,
        "modules": modules,
        "profile": profile_dict(profile),
        "links": [{"id": str(l.id), "kind": l.kind, "label": l.label, "url": l.url,
                   "enabled": l.enabled} for l in links],
        "google_maps_auto": bool(outlet.google_place_id),
        "menu_label": label_for("menu", outlet.vertical),
        "menu": menu_tree(db, outlet, only_available=False),
    }
