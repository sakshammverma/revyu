import uuid

from pydantic import BaseModel, Field

from app.models.event import Event

VALID_EVENT_TYPES = set(Event.EVENT_TYPES)


class EventIn(BaseModel):
    type: str = Field(max_length=40)
    payload: dict | None = None


class EventBatchRequest(BaseModel):
    outlet_id: uuid.UUID
    session_id: uuid.UUID | None = None
    events: list[EventIn] = Field(max_length=50)


class EventBatchResponse(BaseModel):
    accepted: int
