"""Razorpay implementation of PaymentProvider. See documents/04-ARCHITECTURE.md
§9.2: subscription (UPI AutoPay / card mandate) for both plans, first charge
deferred by the trial; one-time order fallback when mandate creation fails
(C-4); all ongoing billing state driven by signature-verified webhooks
(SRS-12.8).

Razorpay plans must be created once in the dashboard (monthly: period
"monthly", interval 1, ₹499; annual: period "yearly", interval 1, ₹4,499) and
their ids set as RAZORPAY_PLAN_ID_MONTHLY / RAZORPAY_PLAN_ID_ANNUAL.
"""

import hashlib
import hmac
import time

import httpx

from app.core.config import get_settings
from app.services.payments.base import CheckoutIntent, PaymentProvider

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

# Upper bound on billing cycles; Razorpay requires a finite count.
TOTAL_COUNT = {"monthly": 120, "annual": 10}


class PaymentProviderUnavailableError(RuntimeError):
    pass


class RazorpayProvider(PaymentProvider):
    name = "razorpay"

    def __init__(self) -> None:
        settings = get_settings()
        self._key_id = settings.razorpay_key_id
        self._key_secret = settings.razorpay_key_secret
        self._webhook_secret = settings.razorpay_webhook_secret
        self._plan_ids = {
            "monthly": settings.razorpay_plan_id_monthly,
            "annual": settings.razorpay_plan_id_annual,
        }

    @property
    def configured(self) -> bool:
        return bool(self._key_id and self._key_secret)

    def create_checkout(
        self,
        *,
        plan_code: str,
        amount_minor: int,
        currency_code: str,
        customer_email: str,
        trial_days: int,
    ) -> CheckoutIntent:
        if not self.configured:
            raise PaymentProviderUnavailableError("Razorpay keys are not configured")

        try:
            return self._create_mandate(plan_code, amount_minor, currency_code, customer_email, trial_days)
        except PaymentProviderUnavailableError:
            # C-4 / SRS-12.3: mandates fail on some banks and UPI apps. Offer
            # the same plan as a one-time payment rather than losing the signup.
            return self._create_order(amount_minor, currency_code, customer_email)

    def _create_mandate(
        self,
        plan_code: str,
        amount_minor: int,
        currency_code: str,
        customer_email: str,
        trial_days: int,
    ) -> CheckoutIntent:
        plan_id = self._plan_ids.get(plan_code)
        if not plan_id:
            raise PaymentProviderUnavailableError(f"No Razorpay plan id configured for {plan_code!r}")
        try:
            resp = httpx.post(
                f"{RAZORPAY_API_BASE}/subscriptions",
                auth=(self._key_id, self._key_secret),
                json={
                    "plan_id": plan_id,
                    "customer_notify": 1,
                    "total_count": TOTAL_COUNT.get(plan_code, 120),
                    # First charge after the trial — nothing is charged today
                    # beyond the gateway's mandate authorisation.
                    "start_at": int(time.time()) + trial_days * 24 * 60 * 60,
                    "notes": {"email": customer_email, "plan": plan_code},
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            raise PaymentProviderUnavailableError(f"Mandate creation failed: {exc}") from exc

        return CheckoutIntent(
            provider=self.name,
            mode="mandate",
            amount_minor=amount_minor,
            currency_code=currency_code,
            key_id=self._key_id,
            provider_subscription_id=data.get("id"),
        )

    def create_order(
        self, *, amount_minor: int, currency_code: str, customer_email: str
    ) -> CheckoutIntent:
        if not self.configured:
            raise PaymentProviderUnavailableError("Razorpay keys are not configured")
        return self._create_order(amount_minor, currency_code, customer_email)

    def _create_order(self, amount_minor: int, currency_code: str, customer_email: str) -> CheckoutIntent:
        try:
            resp = httpx.post(
                f"{RAZORPAY_API_BASE}/orders",
                auth=(self._key_id, self._key_secret),
                json={
                    "amount": amount_minor,
                    "currency": currency_code,
                    "notes": {"email": customer_email},
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError as exc:
            raise PaymentProviderUnavailableError(f"Order creation failed: {exc}") from exc

        return CheckoutIntent(
            provider=self.name,
            mode="one_time",
            amount_minor=amount_minor,
            currency_code=currency_code,
            key_id=self._key_id,
            provider_order_id=data.get("id"),
        )

    def verify_checkout_signature(
        self,
        *,
        payment_id: str,
        signature: str,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> bool:
        if not self._key_secret:
            return False
        # Razorpay's documented formats: subscriptions sign
        # "payment_id|subscription_id"; orders sign "order_id|payment_id".
        if subscription_id:
            message = f"{payment_id}|{subscription_id}"
        elif order_id:
            message = f"{order_id}|{payment_id}"
        else:
            return False
        expected = hmac.new(self._key_secret.encode(), message.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        if not self._webhook_secret:
            return False
        expected = hmac.new(self._webhook_secret.encode(), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    def cancel_subscription(self, subscription_id: str) -> None:
        try:
            resp = httpx.post(
                f"{RAZORPAY_API_BASE}/subscriptions/{subscription_id}/cancel",
                auth=(self._key_id, self._key_secret),
                json={"cancel_at_cycle_end": 0},
                timeout=10.0,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise PaymentProviderUnavailableError(f"Cancel failed: {exc}") from exc

    def refund_payment(self, payment_id: str) -> None:
        try:
            resp = httpx.post(
                f"{RAZORPAY_API_BASE}/payments/{payment_id}/refund",
                auth=(self._key_id, self._key_secret),
                json={},
                timeout=10.0,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise PaymentProviderUnavailableError(f"Refund failed: {exc}") from exc
