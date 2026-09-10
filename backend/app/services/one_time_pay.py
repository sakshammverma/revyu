"""One-time payments (service quotes, print kit) over the PaymentProvider
interface. A payment is only marked paid after the provider's signature for
that exact order verifies; the amount always comes from our own records, never
from the client."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.growth import ServicePayment
from app.services.payments import get_provider, get_provider_by_name
from app.services.payments.razorpay_provider import PaymentProviderUnavailableError


class PayError(Exception):
    def __init__(self, code: str, message: str, status: int = 409):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def start(db: Session, account: Account, *, kind: str, ref_id: uuid.UUID,
          amount_minor: int, currency_code: str) -> dict:
    if amount_minor <= 0:
        raise PayError("NOTHING_TO_PAY", "There is nothing to pay.")
    provider = get_provider("IN")
    try:
        intent = provider.create_order(
            amount_minor=amount_minor, currency_code=currency_code, customer_email=account.owner_email
        )
    except PaymentProviderUnavailableError as exc:
        raise PayError("PAYMENT_UNAVAILABLE", "Payments are unavailable right now. Please try again shortly.", 503) from exc
    db.add(ServicePayment(
        account_id=account.id, kind=kind, ref_id=ref_id, amount_minor=amount_minor,
        currency_code=currency_code, provider=intent.provider,
        provider_order_id=intent.provider_order_id or "",
    ))
    db.commit()
    # Same shape the signup checkout uses, so the existing widget runs it.
    return {
        "provider": intent.provider, "mode": intent.mode, "amount_minor": amount_minor,
        "currency_code": currency_code, "key_id": intent.key_id, "subscription_id": None,
        "order_id": intent.provider_order_id, "trial_days": 0,
        "prefill": {"name": account.owner_name or "", "email": account.owner_email,
                    "contact": account.owner_phone or ""},
    }


def confirm(db: Session, account: Account, *, kind: str, ref_id: uuid.UUID,
            payment_id: str, order_id: str, signature: str) -> ServicePayment:
    pay = db.scalar(select(ServicePayment).where(
        ServicePayment.provider_order_id == order_id,
        ServicePayment.account_id == account.id,
        ServicePayment.kind == kind,
        ServicePayment.ref_id == ref_id,
    ))
    if pay is None:
        raise PayError("UNKNOWN_ORDER", "We couldn't match that payment.", 404)
    if pay.status == "paid":
        return pay  # idempotent: a double-submit is not an error
    ok = get_provider_by_name(pay.provider).verify_checkout_signature(
        payment_id=payment_id, signature=signature, order_id=order_id
    )
    if not ok:
        raise PayError("BAD_SIGNATURE", "We couldn't verify that payment.", 400)
    pay.status = "paid"
    pay.provider_payment_id = None if pay.provider == "mock" else payment_id
    pay.paid_at = datetime.now(timezone.utc)
    db.commit()
    return pay
