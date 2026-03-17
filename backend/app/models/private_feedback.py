import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PrivateFeedback(Base):
    """Private feedback, offered at every rating alongside — never instead of —
    the Google link (CR-3). See documents/05-DATA-MODEL.md §3.6.
    """

    __tablename__ = "private_feedback"
    __table_args__ = (
        Index("ix_private_feedback_outlet_id_created_at", "outlet_id", "created_at"),
        Index("ix_private_feedback_outlet_id_resolved", "outlet_id", "resolved"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )

    rating: Mapped[int | None] = mapped_column(SmallInteger)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    contact: Mapped[str | None] = mapped_column(String)

    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
