import uuid

from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Plan(Base):
    """Pricing per market. Never hardcode prices in application code (FR-71).

    See documents/05-DATA-MODEL.md §3.9a.
    """

    __tablename__ = "plans"
    __table_args__ = (
        Index(
            "ux_plans_code_country_active",
            "code",
            "country_code",
            unique=True,
            postgresql_where=text("active"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    code: Mapped[str] = mapped_column(String, nullable=False)  # monthly | annual
    country_code: Mapped[str] = mapped_column(String, nullable=False)
    currency_code: Mapped[str] = mapped_column(String, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
