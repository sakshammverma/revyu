import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Notification(Base):
    """Delivery log. Debugging and duplicate prevention.

    See documents/05-DATA-MODEL.md §3.10 and the notification adapter design
    in documents/10-ROADMAP.md §1.3 (email primary, click-to-chat secondary,
    WhatsApp Business API deferred to v2 per OD-9).
    """

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_account_id_sent_at", "account_id", "sent_at"),
        Index("ix_notifications_outlet_id_template", "outlet_id", "template"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id")
    )

    template: Mapped[str] = mapped_column(String, nullable=False)
    channel: Mapped[str] = mapped_column(String, nullable=False)  # whatsapp | email
    status: Mapped[str] = mapped_column(String, nullable=False)  # queued|sent|delivered|failed
    error: Mapped[str | None] = mapped_column(String)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Click-to-chat queue (roadmap 1.3): a queued row carries the pre-written
    # message and the recipient, and the founder taps the wa.me link to send.
    to_phone: Mapped[str | None] = mapped_column(String)
    body: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
