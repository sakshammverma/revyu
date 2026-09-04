"""Local-only stand-in for Razorpay, so the signup → approval flow can be run
end to end without gateway keys. Selected automatically when ENVIRONMENT is
"local" and no Razorpay keys are set (see get_provider). Never used anywhere
else: every method refuses outside local.
"""

import uuid

from app.core.config import get_settings
from app.services.payments.base import CheckoutIntent, PaymentProvider

MOCK_SIGNATURE = "mock-signature"


def _assert_local() -> None:
    if get_settings().environment != "local":
        raise RuntimeError("MockPaymentProvider is local-only")


class MockPaymentProvider(PaymentProvider):
    name = "mock"

    def create_checkout(
        self,
        *,
        plan_code: str,
        amount_minor: int,
        currency_code: str,
        customer_email: str,
        trial_days: int,
    ) -> CheckoutIntent:
        _assert_local()
        return CheckoutIntent(
            provider=self.name,
            mode="mock",
            amount_minor=amount_minor,
            currency_code=currency_code,
            provider_subscription_id=f"sub_mock_{uuid.uuid4().hex[:12]}",
        )

    def create_order(
        self, *, amount_minor: int, currency_code: str, customer_email: str
    ) -> CheckoutIntent:
        _assert_local()
        return CheckoutIntent(
            provider=self.name,
            mode="mock",
            amount_minor=amount_minor,
            currency_code=currency_code,
            provider_order_id=f"order_mock_{uuid.uuid4().hex[:12]}",
        )

    def verify_checkout_signature(
        self,
        *,
        payment_id: str,
        signature: str,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> bool:
        _assert_local()
        return signature == MOCK_SIGNATURE

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        return False  # webhooks are never mocked

    def cancel_subscription(self, subscription_id: str) -> None:
        _assert_local()

    def refund_payment(self, payment_id: str) -> None:
        _assert_local()
