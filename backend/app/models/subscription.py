import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Subscription(Base):
    """See documents/05-DATA-MODEL.md §3.8 and §4.2 (status state machine)."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )

    plan: Mapped[str] = mapped_column(String, nullable=False)  # monthly | annual
    # pending -> active -> (past_due <-> active) -> cancelled -> expired
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Which PaymentProvider owns this row ("razorpay" | "mock" local-only).
    provider: Mapped[str] = mapped_column(String, nullable=False, default="razorpay", server_default="razorpay")
    razorpay_subscription_id: Mapped[str | None] = mapped_column(String, index=True)
    # Set for one-time orders (annual fallback / C-4) — lets order.paid resolve
    # the subscription, which razorpay_subscription_id alone cannot.
    razorpay_order_id: Mapped[str | None] = mapped_column(String, index=True)
    # pending | active | failed | not_applicable
    mandate_status: Mapped[str | None] = mapped_column(String)

    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grace_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    account: Mapped["Account"] = relationship(back_populates="subscriptions")
    payments: Mapped[list["Payment"]] = relationship(back_populates="subscription")
