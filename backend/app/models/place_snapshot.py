from datetime import datetime
import uuid

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class PlaceSnapshot(Base):
    """Weekly Google Places poll — a lagging business indicator only.

    Never used for trial metering (C-2, SRS-14.3). See documents/05-DATA-MODEL.md §3.7.
    """

    __tablename__ = "place_snapshots"
    __table_args__ = (
        Index("ix_place_snapshots_outlet_id_polled_at", "outlet_id", "polled_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )

    rating: Mapped[float | None] = mapped_column(Numeric(2, 1))
    review_count: Mapped[int | None] = mapped_column(Integer)

    polled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
