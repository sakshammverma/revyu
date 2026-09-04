"""PaymentProvider interface (FR-72, documents/04-ARCHITECTURE.md §9.2).

Razorpay is the v1 implementation, selected by the outlet's country
(documents/17-GLOBAL-READY.md §2.5). Adding another market's provider means
implementing this interface, not touching billing logic.

Billing model at signup (SRS-18.6, OD-21): the owner authorises payment at
signup, before approval, and the first charge lands when the 15-day trial
ends. So the default checkout is a subscription (mandate) whose start is
deferred by the trial; the one-time order is the C-4 fallback when a mandate
cannot be created, and is charged immediately (refundable on rejection).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class CheckoutIntent:
    provider: str
    mode: str  # "mandate" | "one_time" | "mock"
    amount_minor: int
    currency_code: str
    key_id: str | None = None
    provider_order_id: str | None = None
    provider_subscription_id: str | None = None


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_checkout(
        self,
        *,
        plan_code: str,
        amount_minor: int,
        currency_code: str,
        customer_email: str,
        trial_days: int,
    ) -> CheckoutIntent:
        """Start a deferred-start mandate; fall back to a one-time order (C-4)."""

    def create_order(
        self, *, amount_minor: int, currency_code: str, customer_email: str
    ) -> CheckoutIntent:
        """One-time charge (service quotes, print kit). Not part of the
        subscription flow, so providers opt in."""
        raise NotImplementedError

    @abstractmethod
    def verify_checkout_signature(
        self,
        *,
        payment_id: str,
        signature: str,
        subscription_id: str | None = None,
        order_id: str | None = None,
    ) -> bool:
        """Verify the signature the checkout widget hands back on success."""

    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        ...

    @abstractmethod
    def cancel_subscription(self, subscription_id: str) -> None:
        """Cancel a mandate immediately (signup rejected before first charge)."""

    @abstractmethod
    def refund_payment(self, payment_id: str) -> None:
        """Full refund of a captured payment (SRS-19.7)."""
