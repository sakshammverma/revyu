import uuid

from pydantic import BaseModel, Field


class OutletConfig(BaseModel):
    id: uuid.UUID
    business_name: str
    logo_url: str | None
    vertical: str
    google_review_url: str | None


class TagConfig(BaseModel):
    id: uuid.UUID
    label: str
    phrases: list[str]
    sort_order: int


class FlowConfigResponse(BaseModel):
    collecting: bool
    # SRS-11.17 — draft outlets are fully previewable with a non-production
    # marker; no trial clock, no metering, no events counted toward the
    # funnel. Distinct from `collecting`: a preview shows the full flow
    # without ever being live.
    preview: bool
    outlet: OutletConfig
    tags: list[TagConfig]


class SessionCreateRequest(BaseModel):
    session_id: uuid.UUID
    device_hash: str | None = Field(default=None, max_length=128)


class SessionCreateResponse(BaseModel):
    session_id: uuid.UUID
    started_at: str


class FeedbackCreateRequest(BaseModel):
    session_id: uuid.UUID
    rating: int | None = Field(default=None, ge=1, le=5)
    message: str = Field(max_length=2000)
    contact: str | None = Field(default=None, max_length=200)


class FeedbackCreateResponse(BaseModel):
    id: uuid.UUID
    created_at: str
