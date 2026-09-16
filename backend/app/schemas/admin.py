import uuid

from pydantic import BaseModel


class OwnerInfo(BaseModel):
    name: str | None
    phone: str
    email: str


class GoogleMatchInfo(BaseModel):
    place_id: str | None
    name: str | None
    address: str | None
    rating: float | None
    review_count: int | None


class ApprovalQueueItem(BaseModel):
    outlet_id: uuid.UUID
    business_name: str
    vertical: str
    owner: OwnerInfo
    google_match: GoogleMatchInfo
    preview_url: str
    payment_status: str
    submitted_at: str | None
    age_hours: float


class ApprovalQueueResponse(BaseModel):
    items: list[ApprovalQueueItem]


class ApproveRequest(BaseModel):
    place_verified: bool
    placement_confirmed: bool
    notes: str | None = None


class ApproveResponse(BaseModel):
    state: str
    slug: str
    short_url: str
    activated_at: str


class RequestInfoRequest(BaseModel):
    message: str


class RejectRequest(BaseModel):
    reason: str
    refund: bool = True


class CorrectPlaceRequest(BaseModel):
    place_id: str
