import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CustomerSession(Base):
    """One customer's pass through the flow. Anonymous. See documents/05-DATA-MODEL.md §3.4.

    Table name `sessions` per the data model; class named CustomerSession to
    avoid colliding with SQLAlchemy's own Session type.
    """

    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_outlet_id_started_at", "outlet_id", "started_at"),
        Index("ix_sessions_dedup_lookup", "outlet_id", "device_hash", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )

    # Fingerprint. Trial dedup only (SRS-9.2) — not linked to identity.
    device_hash: Mapped[str | None] = mapped_column(String)
    rating: Mapped[int | None] = mapped_column(SmallInteger)
    selected_tag_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)))

    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    counted_for_trial: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
