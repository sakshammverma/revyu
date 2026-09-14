"""service payments, request paid_at, wallet transfer codes

Revision ID: f6d2b8a4c1e7
Revises: e5c7a9b3d201
Create Date: 2026-10-01 18:00:00

Hand-written.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision: str = "f6d2b8a4c1e7"
down_revision: Union[str, None] = "e5c7a9b3d201"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = pg.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column("service_requests", sa.Column("paid_at", sa.DateTime(timezone=True)))
    op.add_column("loyalty_members", sa.Column("transfer_hash", sa.String(64)))
    op.add_column("loyalty_members", sa.Column("transfer_expires_at", sa.DateTime(timezone=True)))
    op.create_table(
        "service_payments",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("account_id", UUID, sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("ref_id", UUID, nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("provider", sa.String(16), nullable=False),
        sa.Column("provider_order_id", sa.String(), nullable=False, unique=True),
        sa.Column("provider_payment_id", sa.String()),
        sa.Column("status", sa.String(12), nullable=False, server_default="created"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_service_payments_account_id", "service_payments", ["account_id"])
    op.create_index("ix_service_payments_ref_id", "service_payments", ["ref_id"])


def downgrade() -> None:
    op.drop_table("service_payments")
    op.drop_column("loyalty_members", "transfer_expires_at")
    op.drop_column("loyalty_members", "transfer_hash")
    op.drop_column("service_requests", "paid_at")
