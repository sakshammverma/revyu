import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Lead(Base):
    """A prospect who requested a Review Gap Report. Email is used once, to
    send that report; it is not added to any marketing list."""

    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    place_id: Mapped[str] = mapped_column(String, nullable=False)
    business_name: Mapped[str | None] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, nullable=False, default="gap_report")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
