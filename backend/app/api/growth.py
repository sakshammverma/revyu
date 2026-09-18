"""Growth Services (what Revyu sells owners) and the QR print kit.

Owner side: /api/app/services, /api/app/service-requests, print-kit.
Admin side: /api/admin/services/*, /api/admin/service-requests/*, print-kits.
No public price is shown anywhere (decision 2026-10-01): pricing is a quote.
"""
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.admin_auth import require_admin
from app.core.config import get_settings
from app.core.db import get_db
from app.core.owner_auth_dep import get_current_owner
from app.models.account import Account
from app.models.growth import ServiceCatalog, ServiceRequest, ServiceRequestEvent
from app.models.hub import PrintKitOrder
from app.models.outlet import Outlet
from app.services import one_time_pay
from app.services.notifications import _email_backend, notify

PRINT_KIT_DELIVERY_FEE_MINOR = 19_900  # INR 199, flat (decision 2026-10-01)
OPEN = ("requested", "quoted", "accepted", "in_progress")
STATUSES = ("requested", "quoted", "accepted", "in_progress", "delivered", "declined", "cancelled")

owner_router = APIRouter(prefix="/api/app", tags=["growth"])
admin_router = APIRouter(prefix="/api/admin", tags=["growth-admin"], dependencies=[Depends(require_admin)])


def _my_outlet(owner: Account, db: Session) -> Outlet:
    outlet = db.scalar(select(Outlet).where(Outlet.account_id == owner.id))
    if outlet is None:
        raise HTTPException(404, detail={"error": {"code": "OUTLET_NOT_FOUND"}})
    return outlet


def _service_dict(s: ServiceCatalog, *, admin: bool = False) -> dict:
    d = {"id": str(s.id), "key": s.key, "name": s.name, "tagline": s.tagline,
         "description_md": s.description_md, "deliverables": s.deliverables,
         "questions": s.questions, "lead_time_days": s.lead_time_days,
         "cover_image_url": s.cover_image_url}
    if admin:
        d.update(active=s.active, sort_order=s.sort_order)
    return d


def _event(db: Session, req: ServiceRequest, kind: str, body: str, actor: str) -> None:
    db.add(ServiceRequestEvent(request_id=req.id, kind=kind, body=body, actor=actor))


def _request_dict(db: Session, req: ServiceRequest, *, admin: bool, detail: bool = False) -> dict:
    svc = db.get(ServiceCatalog, req.service_id)
    d = {
        "id": str(req.id), "status": req.status, "service_key": svc.key, "service_name": svc.name,
        "brief": req.brief, "answers": req.answers, "currency_code": req.currency_code,
        "quoted_amount_minor": req.quoted_amount_minor,
        "due_at": req.due_at.isoformat() if req.due_at else None,
        "paid": req.paid_at is not None,
        "created_at": req.created_at.isoformat(), "updated_at": req.updated_at.isoformat(),
    }
    if admin:
        outlet = db.get(Outlet, req.outlet_id)
        account = db.get(Account, req.account_id)
        d.update(outlet_id=str(req.outlet_id), business_name=outlet.business_name,
                 owner_email=account.owner_email if account else None)
    if detail:
        q = select(ServiceRequestEvent).where(ServiceRequestEvent.request_id == req.id).order_by(
            ServiceRequestEvent.created_at)
        if not admin:
            q = q.where(ServiceRequestEvent.kind != "note")
        d["events"] = [{"id": str(e.id), "kind": e.kind, "body": e.body, "actor": e.actor,
                        "created_at": e.created_at.isoformat()} for e in db.scalars(q)]
    return d


def _tell_owner(db: Session, req: ServiceRequest, message: str) -> None:
    account = db.get(Account, req.account_id)
    svc = db.get(ServiceCatalog, req.service_id)
    if account is None:
        return
    notify(db, account_id=account.id, outlet_id=req.outlet_id, to_email=account.owner_email,
           template="service_update",
           data={"service_name": svc.name, "message": message,
                 "dashboard_url": f"{get_settings().frontend_base_url}/app/grow/{req.id}"})


def _tell_admin(subject_line: str, message: str) -> None:
    to = get_settings().admin_notify_email
    if not to:
        return
    _email_backend.send(
        to_email=to,
        template="service_update",
        data={"service_name": subject_line, "message": message,
              "dashboard_url": f"{get_settings().frontend_base_url}/admin/services/requests"},
    )


# ================================================================ owner

@owner_router.get("/services")
def list_services(owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ServiceCatalog).where(ServiceCatalog.active.is_(True))
                      .order_by(ServiceCatalog.sort_order)).all()
    return {"items": [_service_dict(s) for s in rows]}


class RequestBody(BaseModel):
    service_key: str
    brief: str | None = Field(default=None, max_length=2000)
    answers: dict[str, str] | None = None


class MessageBody(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


@owner_router.post("/service-requests", status_code=201)
def create_request(body: RequestBody, owner: Account = Depends(get_current_owner),
                   db: Session = Depends(get_db)) -> dict:
    outlet = _my_outlet(owner, db)
    svc = db.scalar(select(ServiceCatalog).where(ServiceCatalog.key == body.service_key,
                                                 ServiceCatalog.active.is_(True)))
    if svc is None:
        raise HTTPException(404, detail={"error": {"code": "SERVICE_NOT_FOUND"}})
    dup = db.scalar(select(ServiceRequest.id).where(
        ServiceRequest.outlet_id == outlet.id, ServiceRequest.service_id == svc.id,
        ServiceRequest.status.in_(OPEN)))
    if dup is not None:
        raise HTTPException(409, detail={"error": {"code": "ALREADY_REQUESTED",
                                                   "message": "You already have an open request for this service.",
                                                   "id": str(dup)}})
    answers = {k[:40]: v[:500] for k, v in (body.answers or {}).items()}
    req = ServiceRequest(account_id=owner.id, outlet_id=outlet.id, service_id=svc.id,
                         brief=(body.brief or "").strip() or None, answers=answers)
    db.add(req)
    db.flush()
    _event(db, req, "status_changed", "Request received", "owner")
    db.commit()
    _tell_admin(f"New request: {svc.name}", f"{outlet.business_name} requested {svc.name}.")
    return _request_dict(db, req, admin=False, detail=True)


@owner_router.get("/service-requests")
def my_requests(owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ServiceRequest).where(ServiceRequest.account_id == owner.id)
                      .order_by(ServiceRequest.created_at.desc())).all()
    return {"items": [_request_dict(db, r, admin=False) for r in rows]}


def _mine(db: Session, owner: Account, request_id: uuid.UUID) -> ServiceRequest:
    req = db.get(ServiceRequest, request_id)
    if req is None or req.account_id != owner.id:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    return req


@owner_router.get("/service-requests/{request_id}")
def my_request(request_id: uuid.UUID, owner: Account = Depends(get_current_owner),
               db: Session = Depends(get_db)) -> dict:
    return _request_dict(db, _mine(db, owner, request_id), admin=False, detail=True)


@owner_router.post("/service-requests/{request_id}/messages", status_code=201)
def owner_message(request_id: uuid.UUID, body: MessageBody, owner: Account = Depends(get_current_owner),
                  db: Session = Depends(get_db)) -> dict:
    req = _mine(db, owner, request_id)
    _event(db, req, "message", body.body.strip(), "owner")
    db.commit()
    _tell_admin("New message on a service request", body.body.strip())
    return _request_dict(db, req, admin=False, detail=True)


@owner_router.post("/service-requests/{request_id}/accept")
def accept_quote(request_id: uuid.UUID, owner: Account = Depends(get_current_owner),
                 db: Session = Depends(get_db)) -> dict:
    req = _mine(db, owner, request_id)
    if req.status != "quoted":
        raise HTTPException(409, detail={"error": {"code": "NOT_QUOTED", "message": "There is no quote to accept."}})
    req.status = "accepted"
    _event(db, req, "status_changed", "Quote accepted", "owner")
    db.commit()
    _tell_admin("Quote accepted", f"Request {req.id} was accepted by the owner.")
    return _request_dict(db, req, admin=False, detail=True)


@owner_router.post("/service-requests/{request_id}/cancel")
def cancel_request(request_id: uuid.UUID, owner: Account = Depends(get_current_owner),
                   db: Session = Depends(get_db)) -> dict:
    req = _mine(db, owner, request_id)
    if req.status not in ("requested", "quoted"):
        raise HTTPException(409, detail={"error": {"code": "CANNOT_CANCEL",
                                                   "message": "Work has started. Message us to change this."}})
    req.status = "cancelled"
    _event(db, req, "status_changed", "Cancelled by you", "owner")
    db.commit()
    return _request_dict(db, req, admin=False, detail=True)


class PayConfirm(BaseModel):
    razorpay_payment_id: str = Field(max_length=100)
    razorpay_order_id: str = Field(max_length=100)
    razorpay_signature: str = Field(max_length=200)


def _pay_err(exc: one_time_pay.PayError) -> HTTPException:
    return HTTPException(exc.status, detail={"error": {"code": exc.code, "message": exc.message}})


@owner_router.post("/service-requests/{request_id}/pay")
def pay_request(request_id: uuid.UUID, owner: Account = Depends(get_current_owner),
                db: Session = Depends(get_db)) -> dict:
    req = _mine(db, owner, request_id)
    if req.status not in ("accepted", "in_progress") or req.paid_at is not None:
        raise HTTPException(409, detail={"error": {"code": "NOT_PAYABLE", "message": "This request isn't waiting for payment."}})
    try:
        return one_time_pay.start(db, owner, kind="service_request", ref_id=req.id,
                                  amount_minor=req.quoted_amount_minor or 0, currency_code=req.currency_code)
    except one_time_pay.PayError as exc:
        raise _pay_err(exc)


@owner_router.post("/service-requests/{request_id}/pay/confirm")
def confirm_request_payment(request_id: uuid.UUID, body: PayConfirm,
                            owner: Account = Depends(get_current_owner),
                            db: Session = Depends(get_db)) -> dict:
    req = _mine(db, owner, request_id)
    try:
        pay = one_time_pay.confirm(db, owner, kind="service_request", ref_id=req.id,
                                   payment_id=body.razorpay_payment_id, order_id=body.razorpay_order_id,
                                   signature=body.razorpay_signature)
    except one_time_pay.PayError as exc:
        raise _pay_err(exc)
    if req.paid_at is None:
        req.paid_at = pay.paid_at or datetime.now(timezone.utc)
        _event(db, req, "status_changed", "Payment received", "owner")
        db.commit()
        _tell_admin("Payment received", f"Request {req.id} was paid ({pay.amount_minor / 100:.2f} {pay.currency_code}).")
    return _request_dict(db, req, admin=False, detail=True)


# ---------------------------------------------------------------- print kit

class PrintKitBody(BaseModel):
    method: Literal["deliver", "self_print"]
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=32)


def _kit_dict(k: PrintKitOrder) -> dict:
    return {"id": str(k.id), "method": k.method, "fee_minor": k.fee_minor,
            "currency_code": k.currency_code, "address": k.address, "phone": k.phone,
            "status": k.status, "created_at": k.created_at.isoformat()}


@owner_router.get("/print-kit")
def print_kit_info(owner: Account = Depends(get_current_owner), db: Session = Depends(get_db)) -> dict:
    outlet = _my_outlet(owner, db)
    rows = db.scalars(select(PrintKitOrder).where(PrintKitOrder.outlet_id == outlet.id)
                      .order_by(PrintKitOrder.created_at.desc())).all()
    return {"delivery_fee_minor": PRINT_KIT_DELIVERY_FEE_MINOR, "currency_code": "INR",
            "orders": [_kit_dict(k) for k in rows]}


@owner_router.post("/print-kit", status_code=201)
def order_print_kit(body: PrintKitBody, owner: Account = Depends(get_current_owner),
                    db: Session = Depends(get_db)) -> dict:
    outlet = _my_outlet(owner, db)
    if body.method == "deliver" and not ((body.address or "").strip() and (body.phone or "").strip()):
        raise HTTPException(422, detail={"error": {"code": "ADDRESS_REQUIRED",
                                                   "message": "Enter a delivery address and phone number."}})
    kit = PrintKitOrder(
        outlet_id=outlet.id, method=body.method,
        fee_minor=PRINT_KIT_DELIVERY_FEE_MINOR if body.method == "deliver" else 0,
        address=(body.address or "").strip() or None, phone=(body.phone or "").strip() or None,
        status="requested" if body.method == "deliver" else "delivered",
    )
    db.add(kit)
    db.commit()
    if body.method == "deliver":
        _tell_admin("Print kit delivery requested", f"{outlet.business_name}: {kit.address} / {kit.phone}")
    return _kit_dict(kit)


def _own_kit(db: Session, owner: Account, kit_id: uuid.UUID) -> PrintKitOrder:
    outlet = _my_outlet(owner, db)
    kit = db.get(PrintKitOrder, kit_id)
    if kit is None or kit.outlet_id != outlet.id:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    return kit


@owner_router.post("/print-kit/{kit_id}/pay")
def pay_print_kit(kit_id: uuid.UUID, owner: Account = Depends(get_current_owner),
                  db: Session = Depends(get_db)) -> dict:
    kit = _own_kit(db, owner, kit_id)
    if kit.method != "deliver" or kit.status != "requested":
        raise HTTPException(409, detail={"error": {"code": "NOT_PAYABLE", "message": "This order doesn't need payment."}})
    try:
        return one_time_pay.start(db, owner, kind="print_kit", ref_id=kit.id,
                                  amount_minor=kit.fee_minor, currency_code=kit.currency_code)
    except one_time_pay.PayError as exc:
        raise _pay_err(exc)


@owner_router.post("/print-kit/{kit_id}/pay/confirm")
def confirm_print_kit_payment(kit_id: uuid.UUID, body: PayConfirm,
                              owner: Account = Depends(get_current_owner),
                              db: Session = Depends(get_db)) -> dict:
    kit = _own_kit(db, owner, kit_id)
    try:
        one_time_pay.confirm(db, owner, kind="print_kit", ref_id=kit.id,
                             payment_id=body.razorpay_payment_id, order_id=body.razorpay_order_id,
                             signature=body.razorpay_signature)
    except one_time_pay.PayError as exc:
        raise _pay_err(exc)
    if kit.status == "requested":
        kit.status = "paid"
        db.commit()
    return _kit_dict(kit)


# ================================================================ admin

class ServiceBody(BaseModel):
    key: str = Field(pattern=r"^[a-z0-9_]{2,40}$")
    name: str = Field(min_length=1, max_length=80)
    tagline: str = Field(max_length=160)
    description_md: str = Field(default="", max_length=8000)
    deliverables: list[str] = Field(default_factory=list, max_length=20)
    questions: list[dict] = Field(default_factory=list, max_length=12)
    lead_time_days: int | None = Field(default=None, ge=1, le=365)
    cover_image_url: str | None = Field(default=None, max_length=300)
    active: bool = True
    sort_order: int = 0


@admin_router.get("/services")
def admin_services(db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(ServiceCatalog).order_by(ServiceCatalog.sort_order)).all()
    return {"items": [_service_dict(s, admin=True) for s in rows]}


@admin_router.post("/services", status_code=201)
def admin_create_service(body: ServiceBody, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(ServiceCatalog.id).where(ServiceCatalog.key == body.key)):
        raise HTTPException(409, detail={"error": {"code": "KEY_TAKEN", "message": "That key is in use."}})
    s = ServiceCatalog(**body.model_dump())
    db.add(s)
    db.commit()
    return _service_dict(s, admin=True)


@admin_router.put("/services/{service_id}")
def admin_update_service(service_id: uuid.UUID, body: ServiceBody, db: Session = Depends(get_db)) -> dict:
    s = db.get(ServiceCatalog, service_id)
    if s is None:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return _service_dict(s, admin=True)


@admin_router.get("/service-requests")
def admin_requests(status: str | None = None, db: Session = Depends(get_db)) -> dict:
    q = select(ServiceRequest).order_by(ServiceRequest.updated_at.desc()).limit(300)
    if status:
        q = q.where(ServiceRequest.status == status)
    return {"items": [_request_dict(db, r, admin=True) for r in db.scalars(q)]}


@admin_router.get("/service-requests/{request_id}")
def admin_request(request_id: uuid.UUID, db: Session = Depends(get_db)) -> dict:
    req = db.get(ServiceRequest, request_id)
    if req is None:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    return _request_dict(db, req, admin=True, detail=True)


class AdminUpdate(BaseModel):
    status: Literal["requested", "quoted", "accepted", "in_progress", "delivered", "declined", "cancelled"] | None = None
    quoted_amount_minor: int | None = Field(default=None, ge=0, le=1_000_000_000)
    due_at: datetime | None = None
    message: str | None = Field(default=None, max_length=2000)  # visible to owner
    note: str | None = Field(default=None, max_length=2000)  # internal only


@admin_router.patch("/service-requests/{request_id}")
def admin_update_request(request_id: uuid.UUID, body: AdminUpdate, db: Session = Depends(get_db)) -> dict:
    req = db.get(ServiceRequest, request_id)
    if req is None:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    owner_msg: list[str] = []
    if body.quoted_amount_minor is not None:
        req.quoted_amount_minor = body.quoted_amount_minor
    if body.due_at is not None:
        req.due_at = body.due_at
    if body.status and body.status != req.status:
        if body.status == "quoted" and req.quoted_amount_minor is None:
            raise HTTPException(422, detail={"error": {"code": "QUOTE_REQUIRED", "message": "Enter a quote amount first."}})
        req.status = body.status
        label = body.status.replace("_", " ").capitalize()
        _event(db, req, "status_changed", label, "admin")
        owner_msg.append(f"Status: {label}.")
    if body.message and body.message.strip():
        _event(db, req, "message", body.message.strip(), "admin")
        owner_msg.append(body.message.strip())
    if body.note and body.note.strip():
        _event(db, req, "note", body.note.strip(), "admin")
    db.commit()
    if owner_msg:
        _tell_owner(db, req, " ".join(owner_msg))
        db.commit()
    return _request_dict(db, req, admin=True, detail=True)


@admin_router.get("/print-kits")
def admin_print_kits(db: Session = Depends(get_db)) -> dict:
    out = []
    for k in db.scalars(select(PrintKitOrder).where(PrintKitOrder.method == "deliver")
                        .order_by(PrintKitOrder.created_at.desc()).limit(200)):
        outlet = db.get(Outlet, k.outlet_id)
        out.append({**_kit_dict(k), "business_name": outlet.business_name})
    return {"items": out}


class KitStatus(BaseModel):
    status: Literal["requested", "paid", "shipped", "delivered", "cancelled"]


@admin_router.patch("/print-kits/{kit_id}", status_code=204)
def admin_kit_status(kit_id: uuid.UUID, body: KitStatus, db: Session = Depends(get_db)) -> None:
    k = db.get(PrintKitOrder, kit_id)
    if k is None:
        raise HTTPException(404, detail={"error": {"code": "NOT_FOUND"}})
    k.status = body.status
    db.commit()
