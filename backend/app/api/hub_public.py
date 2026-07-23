"""Customer-facing hub, Connect, Menu and Rewards endpoints (no owner auth).

Suspended/deactivated outlets serve a neutral payload for every module
(FR-83). Nothing here touches review-side tables.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.flow import _get_outlet_or_404
from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.loyalty import service as loyalty
from app.models.hub import OutletProfile
from app.models.loyalty import LoyaltyBadge, LoyaltyProgram, LoyaltyReward
from app.models.outlet import Outlet
from app.models.referral import OutletModule
from app.services import hub_config as hc
from app.services.outlet_state import is_collecting
from sqlalchemy import select

router = APIRouter(prefix="/api/flow", tags=["hub-public"])


def _live(outlet: Outlet) -> bool:
    return is_collecting(outlet.state) or outlet.state == "draft"


def _header(outlet: Outlet) -> dict:
    return {"id": str(outlet.id), "name": outlet.business_name, "logo_url": outlet.logo_url,
            "vertical": outlet.vertical, "slug": outlet.slug}


@router.get("/{slug}/hub")
def get_hub(slug: str, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not _live(outlet):
        return {"collecting": False, "outlet": _header(outlet), "mode": "direct", "modules": []}
    resolved = hc.resolve_hub(db, outlet)
    profile = db.get(OutletProfile, outlet.id)
    return {
        "collecting": True,
        "outlet": _header(outlet),
        "mode": resolved["mode"],
        "modules": resolved["modules"],
        "profile": hc.profile_dict(profile),
        "open_now": hc.open_now(profile, outlet.timezone),
    }


@router.get("/{slug}/connect")
def get_connect(slug: str, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not _live(outlet):
        return {"collecting": False, "outlet": _header(outlet)}
    profile = db.get(OutletProfile, outlet.id)
    return {"collecting": True, "outlet": _header(outlet), "profile": hc.profile_dict(profile),
            "open_now": hc.open_now(profile, outlet.timezone),
            "links": hc.active_links(db, outlet)}


@router.get("/{slug}/menu")
def get_menu(slug: str, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not _live(outlet):
        return {"collecting": False, "outlet": _header(outlet)}
    from app.hub.registry import label_for
    return {"collecting": True, "outlet": _header(outlet), "label": label_for("menu", outlet.vertical),
            "categories": hc.menu_tree(db, outlet, only_available=False)}


# ------------------------------------------------------------------ rewards

def _rewards_module_on(db: Session, outlet: Outlet) -> bool:
    row = db.scalar(select(OutletModule).where(OutletModule.outlet_id == outlet.id,
                                               OutletModule.module == "rewards"))
    return bool(row and row.enabled and row.available)


def _wallet_member(db: Session, outlet: Outlet, token: str | None):
    member = loyalty.member_by_token(db, outlet.id, token) if token else None
    if member is None:
        raise HTTPException(status_code=401, detail={"error": {"code": "NO_WALLET"}})
    return member


def _lerr(exc: loyalty.LoyaltyError, status: int = 422) -> HTTPException:
    code_status = {"PHONE_EXISTS": 409}
    return HTTPException(status_code=code_status.get(exc.code, status),
                         detail={"error": {"code": exc.code, "message": exc.message}})


class JoinBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=6, max_length=20)
    consent: bool = False


@router.get("/{slug}/rewards")
def get_rewards(slug: str, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not _live(outlet):
        return {"collecting": False, "outlet": _header(outlet)}
    badges = db.scalars(
        select(LoyaltyBadge).where(LoyaltyBadge.outlet_id == outlet.id, LoyaltyBadge.active.is_(True))
        .order_by(LoyaltyBadge.visits_required)
    ).all()
    rewards = {r.badge_id: r for r in db.scalars(
        select(LoyaltyReward).where(LoyaltyReward.badge_id.in_([b.id for b in badges])))} if badges else {}
    prog = db.get(LoyaltyProgram, outlet.id)
    return {
        "collecting": True,
        "outlet": _header(outlet),
        "enabled": _rewards_module_on(db, outlet),
        "terms": prog.terms if prog else None,
        "badges": [{"name": b.name, "icon": b.icon, "visits_required": b.visits_required,
                    "reward_title": rewards[b.id].title if b.id in rewards else None,
                    "reward_terms": rewards[b.id].terms if b.id in rewards else None} for b in badges],
    }


@router.post("/{slug}/rewards/join", status_code=201,
             dependencies=[Depends(rate_limit("loyalty_join", 20, 3600))])
def join_rewards(slug: str, body: JoinBody, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not (is_collecting(outlet.state) and _rewards_module_on(db, outlet)):
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_AVAILABLE"}})
    try:
        member, token = loyalty.join(db, outlet.id, body.name, body.phone, body.consent)
    except loyalty.LoyaltyError as exc:
        raise _lerr(exc)
    return {"token": token, "wallet": loyalty.wallet(db, member, outlet.id)}


class ClaimBody(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


@router.post("/{slug}/rewards/recover", dependencies=[Depends(rate_limit("loyalty_claim", 10, 900))])
def recover_wallet(slug: str, body: ClaimBody, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    try:
        member, token = loyalty.claim_transfer(db, outlet.id, body.phone, body.code)
    except loyalty.LoyaltyError as exc:
        raise HTTPException(status_code=422, detail={"error": {"code": exc.code, "message": exc.message}})
    return {"token": token, "wallet": loyalty.wallet(db, member, outlet.id)}


def _qr_svg(text: str) -> str:
    import io

    import qrcode
    import qrcode.image.svg

    img = qrcode.make(text, image_factory=qrcode.image.svg.SvgPathImage, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode()


@router.get("/{slug}/rewards/wallet", dependencies=[Depends(rate_limit("wallet", 240, 3600))])
def get_wallet(slug: str, x_wallet_token: str | None = Header(default=None),
               db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    member = _wallet_member(db, outlet, x_wallet_token)
    return loyalty.wallet(db, member, outlet.id)


@router.get("/{slug}/rewards/code", dependencies=[Depends(rate_limit("wallet_code", 240, 3600))])
def get_code(slug: str, x_wallet_token: str | None = Header(default=None),
             db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    if not is_collecting(outlet.state):
        raise HTTPException(status_code=403, detail={"error": {"code": "PAUSED"}})
    out = loyalty.visit_code(_wallet_member(db, outlet, x_wallet_token))
    out["qr_svg"] = _qr_svg(out["code"])  # generated here from our own string; staff can scan it
    return out


@router.delete("/{slug}/rewards/wallet", status_code=204)
def delete_wallet(slug: str, x_wallet_token: str | None = Header(default=None),
                  db: Session = Depends(get_db)) -> None:
    outlet = _get_outlet_or_404(db, slug)
    loyalty.delete_member(db, _wallet_member(db, outlet, x_wallet_token))
