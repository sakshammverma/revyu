import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class CompetitorWatch(Base):
    """A nearby business an owner chose to follow. Public Google data only
    (rating + review count from the weekly Places poll); nothing about whether
    the rival uses Revyu is read or shown."""

    __tablename__ = "competitor_watches"
    __table_args__ = (UniqueConstraint("outlet_id", "place_id", name="uq_competitor_watch_outlet_place"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )
    place_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CompetitorSnapshot(Base):
    __tablename__ = "competitor_snapshots"
    __table_args__ = (Index("ix_competitor_snapshots_watch_polled", "watch_id", "polled_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    watch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitor_watches.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[float | None] = mapped_column(Numeric(2, 1))
    review_count: Mapped[int | None] = mapped_column(Integer)
    polled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
