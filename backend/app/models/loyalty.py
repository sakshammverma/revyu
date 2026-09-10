"""Loyalty tables. CR-6: no foreign key to any customer-flow table and no import
from them (enforced by tests/test_hub_loyalty.py)."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _outlet_fk():
    return mapped_column(UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True)


def _now():
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class LoyaltyProgram(Base):
    __tablename__ = "loyalty_programs"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), primary_key=True
    )
    cooldown_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    terms: Mapped[str | None] = mapped_column(Text)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[str | None] = mapped_column(String)


class LoyaltyBadge(Base):
    __tablename__ = "loyalty_badges"

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    icon: Mapped[str] = mapped_column(String(24), nullable=False, default="sparkle")
    visits_required: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class LoyaltyReward(Base):
    __tablename__ = "loyalty_rewards"

    id: Mapped[uuid.UUID] = _pk()
    badge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("loyalty_badges.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # percent_discount | amount_discount | freebie | free_service
    type: Mapped[str] = mapped_column(String(24), nullable=False)
    percent: Mapped[int | None] = mapped_column(Integer)
    value_minor: Mapped[int | None] = mapped_column(Integer)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    terms: Mapped[str | None] = mapped_column(String(400))
    expires_days: Mapped[int | None] = mapped_column(Integer)


class LoyaltyMember(Base):
    """A customer who joined the programme. Name and phone are collected on
    purpose and shown to the owner (decision 2026-10-01). No session_id, ever."""

    __tablename__ = "loyalty_members"
    __table_args__ = (UniqueConstraint("outlet_id", "phone", name="uq_loyalty_member_phone"),)

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    public_id: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    device_token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    code_secret: Mapped[str] = mapped_column(String(64), nullable=False)
    # Consent for the owner to contact them later (notifications are a future feature).
    contact_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = _now()
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Staff-issued one-time code to move a wallet to a new phone.
    transfer_hash: Mapped[str | None] = mapped_column(String(64))
    transfer_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoyaltyLedger(Base):
    """Append-only. Progress and badge state are derived from these rows."""

    __tablename__ = "loyalty_ledger"

    id: Mapped[uuid.UUID] = _pk()
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_members.id"), nullable=False, index=True
    )
    # visit | badge_awarded | reward_issued | reward_redeemed
    kind: Mapped[str] = mapped_column(String(24), nullable=False)
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    staff_pin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = _now()


class LoyaltyRewardGrant(Base):
    __tablename__ = "loyalty_reward_grants"

    id: Mapped[uuid.UUID] = _pk()
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_members.id"), nullable=False, index=True
    )
    reward_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("loyalty_rewards.id"), nullable=False
    )
    redeem_code: Mapped[str] = mapped_column(String(12), nullable=False, unique=True)
    issued_at: Mapped[datetime] = _now()
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redeemed_by_pin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


class StaffPin(Base):
    __tablename__ = "staff_pins"

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    pin_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
