import uuid

from pydantic import BaseModel, EmailStr


class CreateOutletRequest(BaseModel):
    business_name: str
    vertical: str
    owner_phone: str
    owner_email: EmailStr
    owner_name: str | None = None
    google_maps_url: str | None = None  # resolved server-side to a place_id
    place_id: str | None = None


class CreateOutletResponse(BaseModel):
    outlet_id: uuid.UUID
    slug: str
    state: str


class ValidateUrlRequest(BaseModel):
    google_review_url: str


class ValidateUrlResponse(BaseModel):
    valid: bool
    reason: str | None = None


class TagUpdateItem(BaseModel):
    id: uuid.UUID | None = None  # null -> create new
    label: str
    phrases: list[str]
    sort_order: int
    active: bool = True


class UpdateTagsRequest(BaseModel):
    tags: list[TagUpdateItem]


class ActivateOutletResponse(BaseModel):
    slug: str
    short_url: str
    baseline_rating: float | None
    baseline_review_count: int | None
    activated_at: str


class OutletListItem(BaseModel):
    outlet_id: uuid.UUID
    business_name: str
    vertical: str
    state: str
    source: str
    created_at: str


class OutletListResponse(BaseModel):
    items: list[OutletListItem]


class BulkImportRow(BaseModel):
    row: int
    outlet_id: uuid.UUID | None = None
    slug: str | None = None
    status: str  # draft | error
    error: str | None = None


class BulkImportResponse(BaseModel):
    created: int
    failed: int
    rows: list[BulkImportRow]
