import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Tag(Base):
    """Per-outlet chip vocabulary. See documents/05-DATA-MODEL.md §3.3.

    CR-1: `phrases` holds short fragments mapping to one customer-selected
    attribute — never a full review sentence. No review text table exists.
    """

    __tablename__ = "tags"
    __table_args__ = (
        Index("ix_tags_outlet_id_sort_order", "outlet_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )

    # Chip text per locale: {"en": "friendly staff"}
    label: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # >=4 phrase variants per locale: {"en": ["the staff were friendly", ...]}
    phrases: Mapped[dict] = mapped_column(JSONB, nullable=False)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    outlet: Mapped["Outlet"] = relationship(back_populates="tags")
