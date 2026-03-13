import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Account(Base):
    """The billing entity. One per business owner. See documents/05-DATA-MODEL.md §3.1."""

    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # E.164. Account identity and WhatsApp/click-to-chat destination (unchanged by OD-16).
    owner_phone: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # Login identifier and OTP destination (OD-16). Required and unique.
    owner_email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String)
    otp_channel: Mapped[str] = mapped_column(String, nullable=False, default="email")
    # Shareable code for the owner-referral programme (services/referrals.py).
    referral_code: Mapped[str | None] = mapped_column(String, unique=True, index=True)
    referred_by_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    currency_code: Mapped[str] = mapped_column(String, nullable=False, default="INR")
    payment_provider: Mapped[str] = mapped_column(String, nullable=False, default="razorpay")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    outlets: Mapped[list["Outlet"]] = relationship(back_populates="account")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="account")
