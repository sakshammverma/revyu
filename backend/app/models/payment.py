import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Payment(Base):
    """See documents/05-DATA-MODEL.md §3.9.

    Amounts are always integer smallest-currency-unit (paise for INR) stored
    beside their currency_code — never floats, never hardcoded (FR-70).
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False, index=True
    )

    provider_payment_id: Mapped[str | None] = mapped_column(String, unique=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_code: Mapped[str] = mapped_column(String, nullable=False)

    # created | captured | failed | refunded
    status: Mapped[str] = mapped_column(String, nullable=False)
    webhook_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    subscription: Mapped["Subscription"] = relationship(back_populates="payments")
