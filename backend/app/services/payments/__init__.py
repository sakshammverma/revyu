from app.core.config import get_settings
from app.services.payments.base import CheckoutIntent, PaymentProvider
from app.services.payments.mock_provider import MockPaymentProvider
from app.services.payments.razorpay_provider import RazorpayProvider

# Selected by outlet country (documents/17-GLOBAL-READY.md §2.5). Only India
# is live in v1, so this is a flat map rather than a lookup table for now.
PROVIDERS_BY_COUNTRY = {"IN": RazorpayProvider}


def get_provider(country_code: str) -> PaymentProvider:
    provider_cls = PROVIDERS_BY_COUNTRY.get(country_code, RazorpayProvider)
    provider = provider_cls()
    settings = get_settings()
    # Local dev without gateway keys: use the mock so signup can be exercised
    # end to end. Staging/production always get the real provider, and fail
    # loudly (503 PAYMENT_UNAVAILABLE) if it isn't configured.
    if (
        settings.environment == "local"
        and isinstance(provider, RazorpayProvider)
        and not provider.configured
    ):
        return MockPaymentProvider()
    return provider


def get_provider_by_name(name: str) -> PaymentProvider:
    """For follow-up actions (refund/cancel) on an existing subscription."""
    if name == MockPaymentProvider.name:
        return MockPaymentProvider()
    return RazorpayProvider()


__all__ = ["CheckoutIntent", "PaymentProvider", "get_provider", "get_provider_by_name"]
