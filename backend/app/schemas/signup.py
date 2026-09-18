import uuid

from pydantic import BaseModel, EmailStr


class PlaceSearchResult(BaseModel):
    place_id: str
    name: str
    address: str
    rating: float | None
    review_count: int | None


class PlaceSearchResponse(BaseModel):
    results: list[PlaceSearchResult]


class SignupRequest(BaseModel):
    business_name: str
    vertical: str
    owner_name: str
    owner_phone: str
    owner_email: EmailStr
    place_id: str
    plan: str  # monthly | annual
    placement_acknowledged: bool
    referral_code: str | None = None


class CheckoutPrefill(BaseModel):
    name: str
    email: str
    contact: str


class CheckoutInfo(BaseModel):
    provider: str  # razorpay | mock (local only)
    mode: str  # mandate | one_time | mock
    amount_minor: int
    currency_code: str
    # Everything the Razorpay Checkout widget needs to open (null for mock).
    key_id: str | None = None
    subscription_id: str | None = None
    order_id: str | None = None
    trial_days: int = 15
    prefill: CheckoutPrefill | None = None


class SignupConfirmRequest(BaseModel):
    """What Razorpay Checkout's success handler returns. For the local mock
    provider, send razorpay_payment_id="mock" and razorpay_signature=
    "mock-signature"."""

    razorpay_payment_id: str
    razorpay_signature: str
    razorpay_subscription_id: str | None = None
    razorpay_order_id: str | None = None


class SignupResponse(BaseModel):
    signup_id: uuid.UUID
    checkout: CheckoutInfo


class SignupStatusResponse(BaseModel):
    state: str
    submitted_at: str | None
    message: str
