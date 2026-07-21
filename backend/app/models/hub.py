import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _outlet_fk():
    return mapped_column(UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True)


class OutletProfile(Base):
    """Public business card shown in the hub header and Connect (1:1 outlet)."""

    __tablename__ = "outlet_profiles"

    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), primary_key=True
    )
    tagline: Mapped[str | None] = mapped_column(String(160))
    cover_image_url: Mapped[str | None] = mapped_column(String)
    address_line: Mapped[str | None] = mapped_column(String(240))
    locality: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32))
    # {"mon": [["09:00","20:00"]], ...}; missing/empty day = closed
    hours: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class OutletLink(Base):
    __tablename__ = "outlet_links"

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    kind: Mapped[str] = mapped_column(String(24), nullable=False)
    label: Mapped[str | None] = mapped_column(String(60))
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[uuid.UUID] = _pk()
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("menu_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(400))
    amount_minor: Mapped[int | None] = mapped_column(Integer)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    price_on_request: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    price_prefix: Mapped[str | None] = mapped_column(String(12))
    duration_min: Mapped[int | None] = mapped_column(Integer)
    dietary: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    photo_url: Mapped[str | None] = mapped_column(String)
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PrintKitOrder(Base):
    """QR print kit: the owner either prints it themselves or we deliver to the
    shop for a flat fee (decided 2026-10-01)."""

    __tablename__ = "print_kit_orders"

    id: Mapped[uuid.UUID] = _pk()
    outlet_id: Mapped[uuid.UUID] = _outlet_fk()
    method: Mapped[str] = mapped_column(String(16), nullable=False)  # deliver | self_print
    fee_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(32))
    # requested | paid | shipped | delivered | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="requested")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
