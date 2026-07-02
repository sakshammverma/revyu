from datetime import datetime
import uuid

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Event(Base):
    """Append-only. The funnel is derived entirely from this table.

    See documents/05-DATA-MODEL.md §3.5 and §5 (event taxonomy).
    Never updated, never deleted before the 24-month retention expiry (NFR-10).
    """

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_outlet_id_occurred_at", "outlet_id", "occurred_at"),
        Index("ix_events_outlet_id_type_occurred_at", "outlet_id", "type", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )
    # Null for `scan` before session creation.
    session_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)

    type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB)

    # Server-stamped. Client timestamps are never trusted.
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    EVENT_TYPES = (
        "scan",
        "flow_start",
        "rating_selected",
        "tags_selected",
        "draft_viewed",
        "draft_edited",
        "copy_tapped",
        "handoff",
        "private_feedback_opened",
        "private_feedback_submitted",
        "hub_viewed",
        "module_selected",
        "link_clicked",
        "menu_viewed",
        "rewards_viewed",
    )
