import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Outlet(Base):
    """A single physical location. The unit of QR generation, metering, and billing.

    See documents/05-DATA-MODEL.md §3.2 and §4.1 (state machine).
    """

    __tablename__ = "outlets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )

    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    business_name: Mapped[str] = mapped_column(String, nullable=False)
    # Config-driven, not an enum (documents/17-GLOBAL-READY.md §2.1).
    vertical: Mapped[str] = mapped_column(String, nullable=False)

    country_code: Mapped[str] = mapped_column(String, nullable=False, default="IN")
    locale: Mapped[str] = mapped_column(String, nullable=False, default="en-IN")
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="Asia/Kolkata")

    logo_url: Mapped[str | None] = mapped_column(String)
    google_place_id: Mapped[str | None] = mapped_column(String)
    google_review_url: Mapped[str | None] = mapped_column(String)

    # draft | pending_payment | pending_approval | trial | locked | active | past_due | rejected
    # | suspended | deactivated — see ANCHOR: outlet-states
    state: Mapped[str] = mapped_column(String, nullable=False, index=True, default="draft")

    # self_serve | admin | bulk_import
    source: Mapped[str] = mapped_column(String, nullable=False)

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[str | None] = mapped_column(String)
    rejection_reason: Mapped[str | None] = mapped_column(String)

    place_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # receipt | card | standee | sticker
    placement: Mapped[str | None] = mapped_column(String)
    placement_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    trial_flow_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # trial_flow_count's value the moment the outlet locked at day 15 (OD-21).
    # Not in the original 05-DATA-MODEL.md — added so the post-lock 10-credit
    # countdown can be computed without a second counter that could drift.
    locked_at_flow_count: Mapped[int | None] = mapped_column(Integer)

    # direct | menu - what /r/{slug} does. Reserved now because printed QR
    # codes freeze the URL structure (documents/22-HUB-AND-MODULES.md section 9).
    hub_mode: Mapped[str] = mapped_column(String, nullable=False, default="direct", server_default="direct")

    baseline_rating: Mapped[float | None] = mapped_column(Numeric(2, 1))
    baseline_review_count: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["Account"] = relationship(back_populates="outlets")
    tags: Mapped[list["Tag"]] = relationship(back_populates="outlet")

    # Terminal / non-collecting states (documents/05-DATA-MODEL.md §4.1a — ANCHOR: collection-stops).
    NON_COLLECTING_STATES = (
        "suspended", "deactivated", "pending_payment", "pending_approval", "draft", "rejected",
    )
