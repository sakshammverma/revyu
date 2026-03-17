import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class OtpCode(Base):
    """Owner login OTP (SRS-10.1/10.2). Not in the original 05-DATA-MODEL.md —
    added to support OD-16 (email + OTP, no password) without overloading
    `accounts`. 6 digits, 10-minute expiry, max 5 attempts, both a code and a
    single-use magic-link token issued together (SRS-10.1a).
    """

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )

    code: Mapped[str] = mapped_column(String(6), nullable=False)
    magic_token: Mapped[str] = mapped_column(String, nullable=False, unique=True)

    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
