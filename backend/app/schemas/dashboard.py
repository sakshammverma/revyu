import uuid

from pydantic import BaseModel


class OverviewResponse(BaseModel):
    outlet_id: uuid.UUID
    business_name: str
    state: str
    scans: int
    completed_flows: int
    conversion_rate: float
    trial_flow_count: int
    dashboard_locked: bool


class FunnelStep(BaseModel):
    step: str
    count: int
    drop_off_pct: float | None


class FunnelResponse(BaseModel):
    steps: list[FunnelStep]
    note: str  # the instrumentation boundary must be stated wherever the funnel is displayed


class TagFrequencyItem(BaseModel):
    label: str
    count: int


class TagFrequencyResponse(BaseModel):
    tags: list[TagFrequencyItem]


class RatingInfo(BaseModel):
    baseline_rating: float | None
    baseline_review_count: int | None
    current_rating: float | None
    current_review_count: int | None
    polled_at: str | None


class FeedbackItem(BaseModel):
    id: uuid.UUID
    rating: int | None
    message: str
    contact: str | None
    resolved: bool
    created_at: str


class FeedbackInboxResponse(BaseModel):
    items: list[FeedbackItem]


class ResolveFeedbackRequest(BaseModel):
    resolved: bool
