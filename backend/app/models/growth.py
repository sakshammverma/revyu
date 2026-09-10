import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ServiceCatalog(Base):
    """What Revyu sells to owners. A new service is a row. No public price is
    shown (decision 2026-10-01): pricing happens through a quote."""

    __tablename__ = "service_catalog"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    tagline: Mapped[str] = mapped_column(String(160), nullable=False)
    description_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    deliverables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # [{"key": "domain", "label": "...", "type": "text|choice", "options": [...]}]
    questions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    cover_image_url: Mapped[str | None] = mapped_column(String)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )
    outlet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("outlets.id"), nullable=False, index=True
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("service_catalog.id"), nullable=False
    )
    # requested | quoted | accepted | in_progress | delivered | declined | cancelled
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="requested", index=True)
    brief: Mapped[str | None] = mapped_column(Text)
    answers: Mapped[dict | None] = mapped_column(JSONB)
    quoted_amount_minor: Mapped[int | None] = mapped_column(Integer)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class ServiceRequestEvent(Base):
    __tablename__ = "service_request_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # status_changed | message | note (note = admin-internal, never shown to owner)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    actor: Mapped[str] = mapped_column(String(8), nullable=False)  # owner | admin
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ServicePayment(Base):
    """One-time payments for service quotes and the print kit (not the
    subscription). A row is created with the order and marked paid only after
    the provider signature verifies."""

    __tablename__ = "service_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # service_request | print_kit
    ref_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    provider: Mapped[str] = mapped_column(String(16), nullable=False)
    provider_order_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="created")  # created | paid
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
