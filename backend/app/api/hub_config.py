"""QR-page configuration API, mounted twice from one factory:

  /api/app/outlets/{id}/hub    owner session
  /api/admin/outlets/{id}/hub  admin token

Both call services/hub_config.py, so the owner and the Revyu admin always see
and edit exactly the same thing (documents/24-HUB-BUILD-PLAN.md section 5).
"""
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.loyalty import service as loyalty
from app.models.account import Account
from app.models.hub import MenuCategory, MenuItem, OutletLink, OutletProfile
from app.models.loyalty import LoyaltyBadge, LoyaltyProgram, LoyaltyReward, StaffPin
from app.models.outlet import Outlet
from app.services import hub_config as hc
from app.services.links import LINK_KINDS, LinkError, normalize_link
from app.services.storage import ImageError, save_image

# ---------------------------------------------------------------- schemas


class ModuleItem(BaseModel):
    module: str
    enabled: bool


class ModulesBody(BaseModel):
    modules: list[ModuleItem] = Field(max_length=10)


class HubModeBody(BaseModel):
    hub_mode: Literal["direct", "menu"]


class ProfileBody(BaseModel):
    tagline: str | None = Field(default=None, max_length=160)
    cover_image_url: str | None = Field(default=None, max_length=300)
    address_line: str | None = Field(default=None, max_length=240)
    locality: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    hours: dict[str, list[list[str]]] | None = None


class LinkIn(BaseModel):
    kind: str
    label: str | None = Field(default=None, max_length=60)
    url: str = Field(max_length=500)
    enabled: bool = True


class LinksBody(BaseModel):
    links: list[LinkIn] = Field(max_length=20)


class CategoryBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ItemBody(BaseModel):
    category_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=400)
    amount_minor: int | None = Field(default=None, ge=0, le=100_000_000)
    price_on_request: bool = False
    price_prefix: str | None = Field(default=None, max_length=12)
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    dietary: list[str] = Field(default_factory=list, max_length=6)
    photo_url: str | None = Field(default=None, max_length=300)
    available: bool = True


class OrderBody(BaseModel):
    ids: list[uuid.UUID] = Field(max_length=500)


class ProgramBody(BaseModel):
    cooldown_hours: int = Field(ge=0, le=720)
    terms: str | None = Field(default=None, max_length=1000)


class RewardIn(BaseModel):
    type: Literal["percent_discount", "amount_discount", "freebie", "free_service"]
    percent: int | None = Field(default=None, ge=1, le=100)
    value_minor: int | None = Field(default=None, ge=0, le=100_000_000)
    title: str = Field(min_length=1, max_length=120)
    terms: str | None = Field(default=None, max_length=400)
    expires_days: int | None = Field(default=None, ge=1, le=730)


class BadgeBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    icon: str = "star"
    visits_required: int = Field(ge=1, le=1000)
    active: bool = True
    reward: RewardIn


class PinBody(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    pin: str = Field(pattern=r"^\d{4,6}$")


class AvailabilityBody(BaseModel):
    module: str
    available: bool


# ---------------------------------------------------------------- factory


def _own_outlet(outlet_id: uuid.UUID, owner: Account = Depends(get_current_owner),
                db: Session = Depends(get_db)) -> Outlet:
    outlet = db.get(Outlet, outlet_id)
    if outlet is None or outlet.account_id != owner.id:
        raise HTTPException(status_code=403, detail={"error": {"code": "FORBIDDEN"}})
    return outlet


def _any_outlet(outlet_id: uuid.UUID, db: Session = Depends(get_db)) -> Outlet:
    outlet = db.get(Outlet, outlet_id)
    if outlet is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


def _err(exc: hc.HubConfigError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail={"error": {"code": exc.code, "message": exc.message}})


def _own_badge(db: Session, outlet: Outlet, badge_id: uuid.UUID) -> LoyaltyBadge:
    badge = db.get(LoyaltyBadge, badge_id)
    if badge is None or badge.outlet_id != outlet.id:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND"}})
    return badge


def _validate_reward(r: RewardIn) -> None:
    if r.type == "percent_discount" and not r.percent:
        raise HTTPException(422, detail={"error": {"code": "BAD_REWARD", "message": "Enter a discount percentage."}})
    if r.type == "amount_discount" and not r.value_minor:
        raise HTTPException(422, detail={"error": {"code": "BAD_REWARD", "message": "Enter a discount amount."}})


def _save_badge(db: Session, outlet: Outlet, badge: LoyaltyBadge, body: BadgeBody) -> None:
    if body.icon not in loyalty.ICONS:
        raise HTTPException(422, detail={"error": {"code": "BAD_ICON", "message": "Unknown icon."}})
    _validate_reward(body.reward)
    badge.name, badge.icon = body.name.strip(), body.icon
    badge.visits_required, badge.active = body.visits_required, body.active
    db.add(badge)
    db.flush()
    reward = db.scalar(select(LoyaltyReward).where(LoyaltyReward.badge_id == badge.id))
    if reward is None:
        reward = LoyaltyReward(badge_id=badge.id)
        db.add(reward)
    r = body.reward
    reward.type, reward.title, reward.terms = r.type, r.title.strip(), r.terms
    reward.percent = r.percent if r.type == "percent_discount" else None
    reward.value_minor = r.value_minor if r.type == "amount_discount" else None
    reward.expires_days = r.expires_days
    db.commit()


def _badge_dict(db: Session, b: LoyaltyBadge) -> dict:
    r = db.scalar(select(LoyaltyReward).where(LoyaltyReward.badge_id == b.id))
    return {
        "id": str(b.id), "name": b.name, "icon": b.icon, "visits_required": b.visits_required,
        "active": b.active,
        "reward": None if r is None else {
            "type": r.type, "percent": r.percent, "value_minor": r.value_minor, "title": r.title,
            "terms": r.terms, "expires_days": r.expires_days,
        },
    }


def make_router(prefix: str, outlet_dep, *, is_admin: bool, extra_deps: list | None = None) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=["hub-config-admin" if is_admin else "hub-config"],
                       dependencies=extra_deps or [])
    OutletDep = Annotated[Outlet, Depends(outlet_dep)]
    Db = Annotated[Session, Depends(get_db)]

    @router.get("")
    def get_state(outlet: OutletDep, db: Db) -> dict:
        state = hc.editor_state(db, outlet)
        state["origin"] = get_settings().public_flow_base_url
        return state

    @router.patch("", status_code=204)
    def patch_mode(body: HubModeBody, outlet: OutletDep, db: Db) -> None:
        outlet.hub_mode = body.hub_mode
        db.commit()

    @router.put("/modules", status_code=204)
    def put_modules(body: ModulesBody, outlet: OutletDep, db: Db) -> None:
        try:
            hc.set_modules(db, outlet, [m.model_dump() for m in body.modules], is_admin=is_admin)
        except hc.HubConfigError as exc:
            db.rollback()
            raise _err(exc)

    @router.patch("/profile", status_code=204)
    def patch_profile(body: ProfileBody, outlet: OutletDep, db: Db) -> None:
        profile = db.get(OutletProfile, outlet.id) or OutletProfile(outlet_id=outlet.id)
        for field, value in body.model_dump(exclude_unset=True).items():
            if isinstance(value, str):
                value = value.strip() or None
            setattr(profile, field, value)
        db.add(profile)
        db.commit()

    @router.put("/links", status_code=204)
    def put_links(body: LinksBody, outlet: OutletDep, db: Db) -> None:
        own = tuple(h for h in (
            (get_settings().public_flow_base_url.split("//")[-1].split("/")[0].split(":")[0]),
        ) if h and h != "localhost")
        clean: list[OutletLink] = []
        for i, link in enumerate(body.links):
            if link.kind not in LINK_KINDS:
                raise HTTPException(422, detail={"error": {"code": "BAD_LINK", "message": "Unknown link type."}})
            try:
                url = normalize_link(link.kind, link.url, own_hosts=own)
            except LinkError as exc:
                raise HTTPException(422, detail={"error": {"code": "BAD_LINK", "message": str(exc), "index": i}})
            clean.append(OutletLink(outlet_id=outlet.id, kind=link.kind, label=(link.label or "").strip() or None,
                                    url=url, sort_order=i, enabled=link.enabled))
        db.query(OutletLink).filter(OutletLink.outlet_id == outlet.id).delete()
        db.add_all(clean)
        db.commit()

    # ---- menu
    @router.post("/menu/categories", status_code=201)
    def add_category(body: CategoryBody, outlet: OutletDep, db: Db) -> dict:
        n = db.query(MenuCategory).filter(MenuCategory.outlet_id == outlet.id).count()
        if n >= 40:
            raise HTTPException(422, detail={"error": {"code": "LIMIT", "message": "Too many categories."}})
        cat = MenuCategory(outlet_id=outlet.id, name=body.name.strip(), sort_order=n)
        db.add(cat)
        db.commit()
        return {"id": str(cat.id), "name": cat.name, "items": []}

    @router.patch("/menu/categories/{category_id}", status_code=204)
    def rename_category(category_id: uuid.UUID, body: CategoryBody, outlet: OutletDep, db: Db) -> None:
        try:
            hc.owned_category(db, outlet, category_id).name = body.name.strip()
        except hc.HubConfigError as exc:
            raise _err(exc)
        db.commit()

    @router.delete("/menu/categories/{category_id}", status_code=204)
    def delete_category(category_id: uuid.UUID, outlet: OutletDep, db: Db) -> None:
        try:
            cat = hc.owned_category(db, outlet, category_id)
        except hc.HubConfigError as exc:
            raise _err(exc)
        db.query(MenuItem).filter(MenuItem.category_id == cat.id).delete()
        db.delete(cat)
        db.commit()

    @router.put("/menu/categories-order", status_code=204)
    def order_categories(body: OrderBody, outlet: OutletDep, db: Db) -> None:
        for i, cid in enumerate(body.ids):
            try:
                hc.owned_category(db, outlet, cid).sort_order = i
            except hc.HubConfigError as exc:
                raise _err(exc)
        db.commit()

    def _apply_item(item: MenuItem, body: ItemBody) -> None:
        item.name = body.name.strip()
        item.description = (body.description or "").strip() or None
        item.price_on_request = body.price_on_request
        item.amount_minor = None if body.price_on_request else body.amount_minor
        item.price_prefix = (body.price_prefix or "").strip() or None
        item.duration_min = body.duration_min
        item.dietary = [d for d in body.dietary if d in ("veg", "non_veg", "vegan", "egg")]
        item.photo_url = body.photo_url
        item.available = body.available

    @router.post("/menu/items", status_code=201)
    def add_item(body: ItemBody, outlet: OutletDep, db: Db) -> dict:
        if body.category_id is None:
            raise HTTPException(422, detail={"error": {"code": "NO_CATEGORY", "message": "Choose a category."}})
        try:
            cat = hc.owned_category(db, outlet, body.category_id)
        except hc.HubConfigError as exc:
            raise _err(exc)
        n = db.query(MenuItem).filter(MenuItem.category_id == cat.id).count()
        item = MenuItem(category_id=cat.id, sort_order=n, currency_code="INR")
        _apply_item(item, body)
        db.add(item)
        db.commit()
        return hc.item_dict(item)

    @router.patch("/menu/items/{item_id}")
    def edit_item(item_id: uuid.UUID, body: ItemBody, outlet: OutletDep, db: Db) -> dict:
        try:
            item = hc.owned_item(db, outlet, item_id)
            if body.category_id and body.category_id != item.category_id:
                item.category_id = hc.owned_category(db, outlet, body.category_id).id
        except hc.HubConfigError as exc:
            raise _err(exc)
        _apply_item(item, body)
        db.commit()
        return hc.item_dict(item)

    @router.delete("/menu/items/{item_id}", status_code=204)
    def delete_item(item_id: uuid.UUID, outlet: OutletDep, db: Db) -> None:
        try:
            db.delete(hc.owned_item(db, outlet, item_id))
        except hc.HubConfigError as exc:
            raise _err(exc)
        db.commit()

    @router.put("/menu/items-order", status_code=204)
    def order_items(body: OrderBody, outlet: OutletDep, db: Db) -> None:
        for i, iid in enumerate(body.ids):
            try:
                hc.owned_item(db, outlet, iid).sort_order = i
            except hc.HubConfigError as exc:
                raise _err(exc)
        db.commit()

    @router.post("/uploads", status_code=201)
    async def upload(outlet: OutletDep, file: UploadFile = File(...)) -> dict:
        data = await file.read(6 * 1024 * 1024)
        try:
            return {"url": save_image(data)}
        except ImageError as exc:
            raise HTTPException(422, detail={"error": {"code": "BAD_IMAGE", "message": str(exc)}})

    # ---- loyalty
    @router.get("/loyalty")
    def get_loyalty(outlet: OutletDep, db: Db) -> dict:
        prog = db.get(LoyaltyProgram, outlet.id)
        badges = db.scalars(
            select(LoyaltyBadge).where(LoyaltyBadge.outlet_id == outlet.id).order_by(LoyaltyBadge.visits_required)
        ).all()
        pins = db.scalars(select(StaffPin).where(StaffPin.outlet_id == outlet.id)).all()
        return {
            "acknowledged": bool(prog and prog.acknowledged_at),
            "cooldown_hours": prog.cooldown_hours if prog else 12,
            "terms": prog.terms if prog else None,
            "icons": list(loyalty.ICONS),
            "badges": [_badge_dict(db, b) for b in badges],
            "staff_pins": [{"id": str(p.id), "label": p.label, "active": p.active} for p in pins],
            "staff_url": f"{get_settings().public_flow_base_url}/staff/{outlet.slug}",
            "stats": loyalty.stats(db, outlet.id),
        }

    @router.put("/loyalty", status_code=204)
    def put_program(body: ProgramBody, outlet: OutletDep, db: Db) -> None:
        prog = db.get(LoyaltyProgram, outlet.id) or LoyaltyProgram(outlet_id=outlet.id)
        prog.cooldown_hours, prog.terms = body.cooldown_hours, (body.terms or "").strip() or None
        db.add(prog)
        db.commit()

    @router.post("/loyalty/acknowledge", status_code=204)
    def acknowledge(outlet: OutletDep, db: Db) -> None:
        from datetime import datetime, timezone
        prog = db.get(LoyaltyProgram, outlet.id) or LoyaltyProgram(outlet_id=outlet.id)
        prog.acknowledged_at = datetime.now(timezone.utc)
        prog.acknowledged_by = "admin" if is_admin else "owner"
        db.add(prog)
        db.commit()

    @router.post("/loyalty/badges", status_code=201)
    def add_badge(body: BadgeBody, outlet: OutletDep, db: Db) -> dict:
        badge = LoyaltyBadge(outlet_id=outlet.id, sort_order=db.query(LoyaltyBadge).filter(
            LoyaltyBadge.outlet_id == outlet.id).count())
        _save_badge(db, outlet, badge, body)
        return _badge_dict(db, badge)

    @router.put("/loyalty/badges/{badge_id}")
    def edit_badge(badge_id: uuid.UUID, body: BadgeBody, outlet: OutletDep, db: Db) -> dict:
        badge = _own_badge(db, outlet, badge_id)
        _save_badge(db, outlet, badge, body)
        return _badge_dict(db, badge)

    @router.delete("/loyalty/badges/{badge_id}", status_code=204)
    def delete_badge(badge_id: uuid.UUID, outlet: OutletDep, db: Db) -> None:
        # Earned history must survive: retire instead of deleting.
        _own_badge(db, outlet, badge_id).active = False
        db.commit()

    @router.post("/loyalty/staff-pins", status_code=201)
    def add_pin(body: PinBody, outlet: OutletDep, db: Db) -> dict:
        if loyalty.find_pin(db, outlet.id, body.pin) is not None:
            raise HTTPException(422, detail={"error": {"code": "PIN_TAKEN", "message": "Choose a different PIN."}})
        pin = StaffPin(outlet_id=outlet.id, label=body.label.strip(), pin_hash=loyalty.hash_pin(body.pin))
        db.add(pin)
        db.commit()
        return {"id": str(pin.id), "label": pin.label, "active": True}

    @router.patch("/loyalty/staff-pins/{pin_id}", status_code=204)
    def toggle_pin(pin_id: uuid.UUID, outlet: OutletDep, db: Db, active: bool = True) -> None:
        pin = db.get(StaffPin, pin_id)
        if pin is None or pin.outlet_id != outlet.id:
            raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
        pin.active = active
        db.commit()

    @router.get("/loyalty/members")
    def members(outlet: OutletDep, db: Db) -> dict:
        return {"items": loyalty.member_rows(db, outlet.id)}

    @router.get("/loyalty/redemptions")
    def redemptions(outlet: OutletDep, db: Db) -> dict:
        return {"items": loyalty.redemption_log(db, outlet.id)}

    @router.get("/insights")
    def insights(outlet: OutletDep, db: Db, days: int = 30) -> dict:
        """Hub and Connect activity (customer-flow events only). Kept apart
        from rewards numbers on purpose (CR-6.4)."""
        from collections import Counter
        from datetime import datetime, timedelta, timezone

        from app.models.event import Event

        since = datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))
        rows = db.execute(
            select(Event.type, Event.payload).where(
                Event.outlet_id == outlet.id, Event.occurred_at >= since,
                Event.type.in_(("scan", "hub_viewed", "module_selected", "link_clicked", "menu_viewed", "rewards_viewed")),
            )
        ).all()
        by_type = Counter(t for t, _ in rows)
        modules = Counter((p or {}).get("module", "?") for t, p in rows if t == "module_selected")
        links = Counter((p or {}).get("kind", "?") for t, p in rows if t == "link_clicked")
        hub_views = by_type["hub_viewed"]
        return {
            "days": days, "scans": by_type["scan"], "hub_views": hub_views,
            "modules": dict(modules), "links": dict(links),
            "menu_views": by_type["menu_viewed"], "rewards_views": by_type["rewards_viewed"],
            "take_rate": round(modules.get("review", 0) / hub_views, 3) if hub_views else None,
        }

    if is_admin:
        @router.put("/availability", status_code=204)
        def availability(body: AvailabilityBody, outlet: OutletDep, db: Db) -> None:
            try:
                hc.set_availability(db, outlet, body.module, body.available)
            except hc.HubConfigError as exc:
                raise _err(exc)

    return router


owner_router = make_router("/api/app/outlets/{outlet_id}/hub", _own_outlet, is_admin=False)
admin_router = make_router("/api/admin/outlets/{outlet_id}/hub", _any_outlet, is_admin=True,
                           extra_deps=[Depends(require_admin)])
