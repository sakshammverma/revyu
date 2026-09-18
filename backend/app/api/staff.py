"""Staff console API. Staff authenticate with an owner-issued PIN (not an owner
login) and get an 8-hour outlet-scoped bearer token."""
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.flow import _get_outlet_or_404
from app.core.db import get_db
from app.core.ratelimit import rate_limit
from app.loyalty import service as loyalty
from app.models.outlet import Outlet
from app.services.outlet_state import is_collecting

router = APIRouter(prefix="/api/staff")


class LoginBody(BaseModel):
    pin: str = Field(pattern=r"^\d{4,6}$")


class VisitBody(BaseModel):
    code: str = Field(min_length=3, max_length=20)


class RedeemBody(BaseModel):
    redeem_code: str = Field(min_length=4, max_length=12)


def _staff(slug: str, authorization: str = Header(default=""),
           db: Session = Depends(get_db)) -> tuple[Outlet, uuid.UUID]:
    outlet = _get_outlet_or_404(db, slug)
    parsed = loyalty.read_staff_token(authorization.removeprefix("Bearer ").strip())
    if parsed is None or parsed[0] != outlet.id:
        raise HTTPException(status_code=401, detail={"error": {"code": "UNAUTHORIZED"}})
    return outlet, parsed[1]


def _lerr(exc: loyalty.LoyaltyError) -> HTTPException:
    return HTTPException(status_code=422, detail={"error": {"code": exc.code, "message": exc.message}})


@router.post("/{slug}/login", dependencies=[Depends(rate_limit("staff_login", 10, 900))])
def login(slug: str, body: LoginBody, db: Session = Depends(get_db)) -> dict:
    outlet = _get_outlet_or_404(db, slug)
    pin = loyalty.find_pin(db, outlet.id, body.pin)
    if pin is None:
        raise HTTPException(status_code=401, detail={"error": {"code": "BAD_PIN", "message": "Wrong PIN."}})
    return {"token": loyalty.make_staff_token(outlet.id, pin.id), "label": pin.label,
            "outlet_name": outlet.business_name}


@router.post("/{slug}/visits", dependencies=[Depends(rate_limit("staff_visit", 120, 3600))])
def record_visit(body: VisitBody, ctx: tuple[Outlet, uuid.UUID] = Depends(_staff),
                 db: Session = Depends(get_db)) -> dict:
    outlet, pin_id = ctx
    if not is_collecting(outlet.state):
        raise HTTPException(status_code=403, detail={"error": {"code": "PAUSED"}})
    try:
        return loyalty.record_visit(db, outlet.id, pin_id, body.code)
    except loyalty.LoyaltyError as exc:
        raise _lerr(exc)


@router.get("/{slug}/member/{public_id}")
def lookup_member(public_id: str, ctx: tuple[Outlet, uuid.UUID] = Depends(_staff),
                  db: Session = Depends(get_db)) -> dict:
    outlet, _ = ctx
    member = loyalty.find_member_by_ref(db, outlet.id, public_id)
    if member is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "No such member."}})
    return {"member": {"public_id": member.public_id, "name": member.name},
            "visits": loyalty.visit_count(db, member.id),
            "pending_rewards": [g for g in loyalty.open_grants(db, member.id) if g["status"] == "available"]}


@router.post("/{slug}/redeem", dependencies=[Depends(rate_limit("staff_redeem", 120, 3600))])
def redeem(body: RedeemBody, ctx: tuple[Outlet, uuid.UUID] = Depends(_staff),
           db: Session = Depends(get_db)) -> dict:
    outlet, pin_id = ctx
    try:
        return loyalty.redeem(db, outlet.id, pin_id, body.redeem_code)
    except loyalty.LoyaltyError as exc:
        raise _lerr(exc)


@router.post("/{slug}/member/{public_id}/transfer", dependencies=[Depends(rate_limit("staff_transfer", 30, 3600))])
def issue_transfer(public_id: str, ctx: tuple[Outlet, uuid.UUID] = Depends(_staff),
                   db: Session = Depends(get_db)) -> dict:
    outlet, _ = ctx
    try:
        return loyalty.issue_transfer_code(db, outlet.id, public_id)
    except loyalty.LoyaltyError as exc:
        raise _lerr(exc)
