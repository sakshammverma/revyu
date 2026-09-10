"""hub profile/links, menu, loyalty, growth services, print kit

Revision ID: d4b8f1a2c6e0
Revises: c3a9e5d17b42
Create Date: 2026-10-01 14:00:00

Hand-written. Implements documents/24-HUB-BUILD-PLAN.md section 2.
CR-6: no loyalty table has a foreign key to a review-side table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg


revision: str = "d4b8f1a2c6e0"
down_revision: Union[str, None] = "c3a9e5d17b42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = pg.UUID(as_uuid=True)


def _ts(name: str = "created_at"):
    return sa.Column(name, sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now())


def _outlet_col():
    return sa.Column("outlet_id", UUID, sa.ForeignKey("outlets.id"), nullable=False)


def upgrade() -> None:
    op.add_column(
        "outlet_modules",
        sa.Column("available", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "outlet_profiles",
        sa.Column("outlet_id", UUID, sa.ForeignKey("outlets.id"), primary_key=True),
        sa.Column("tagline", sa.String(160)),
        sa.Column("cover_image_url", sa.String()),
        sa.Column("address_line", sa.String(240)),
        sa.Column("locality", sa.String(120)),
        sa.Column("phone", sa.String(32)),
        sa.Column("hours", pg.JSONB()),
        _ts("updated_at"),
    )

    op.create_table(
        "outlet_links",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("label", sa.String(60)),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_outlet_links_outlet_id", "outlet_links", ["outlet_id"])

    op.create_table(
        "menu_categories",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_menu_categories_outlet_id", "menu_categories", ["outlet_id"])

    op.create_table(
        "menu_items",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("category_id", UUID, sa.ForeignKey("menu_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(400)),
        sa.Column("amount_minor", sa.Integer()),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("price_on_request", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("price_prefix", sa.String(12)),
        sa.Column("duration_min", sa.Integer()),
        sa.Column("dietary", pg.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("photo_url", sa.String()),
        sa.Column("available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_menu_items_category_id", "menu_items", ["category_id"])

    op.create_table(
        "print_kit_orders",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("method", sa.String(16), nullable=False),
        sa.Column("fee_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("address", sa.Text()),
        sa.Column("phone", sa.String(32)),
        sa.Column("status", sa.String(16), nullable=False, server_default="requested"),
        _ts(),
    )
    op.create_index("ix_print_kit_orders_outlet_id", "print_kit_orders", ["outlet_id"])

    # ---- loyalty (CR-6: no FK to sessions / events / private_feedback) ----
    op.create_table(
        "loyalty_programs",
        sa.Column("outlet_id", UUID, sa.ForeignKey("outlets.id"), primary_key=True),
        sa.Column("cooldown_hours", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("terms", sa.Text()),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("acknowledged_by", sa.String()),
    )
    op.create_table(
        "loyalty_badges",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("icon", sa.String(24), nullable=False, server_default="sparkle"),
        sa.Column("visits_required", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_loyalty_badges_outlet_id", "loyalty_badges", ["outlet_id"])
    op.create_table(
        "loyalty_rewards",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("badge_id", UUID, sa.ForeignKey("loyalty_badges.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("type", sa.String(24), nullable=False),
        sa.Column("percent", sa.Integer()),
        sa.Column("value_minor", sa.Integer()),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("terms", sa.String(400)),
        sa.Column("expires_days", sa.Integer()),
    )
    op.create_table(
        "loyalty_members",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("public_id", sa.String(8), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("device_token_hash", sa.String(64), nullable=False),
        sa.Column("code_secret", sa.String(64), nullable=False),
        sa.Column("contact_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts(),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("outlet_id", "phone", name="uq_loyalty_member_phone"),
    )
    op.create_index("ix_loyalty_members_outlet_id", "loyalty_members", ["outlet_id"])
    op.create_index("ix_loyalty_members_public_id", "loyalty_members", ["public_id"])
    op.create_index("ix_loyalty_members_device", "loyalty_members", ["device_token_hash"])
    op.create_table(
        "loyalty_ledger",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("member_id", UUID, sa.ForeignKey("loyalty_members.id"), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("ref_id", UUID),
        sa.Column("staff_pin_id", UUID),
        _ts(),
    )
    op.create_index("ix_loyalty_ledger_member_id", "loyalty_ledger", ["member_id"])
    op.create_table(
        "loyalty_reward_grants",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("member_id", UUID, sa.ForeignKey("loyalty_members.id"), nullable=False),
        sa.Column("reward_id", UUID, sa.ForeignKey("loyalty_rewards.id"), nullable=False),
        sa.Column("redeem_code", sa.String(12), nullable=False, unique=True),
        _ts("issued_at"),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("redeemed_at", sa.DateTime(timezone=True)),
        sa.Column("redeemed_by_pin_id", UUID),
    )
    op.create_index("ix_loyalty_grants_member_id", "loyalty_reward_grants", ["member_id"])
    op.create_table(
        "staff_pins",
        sa.Column("id", UUID, primary_key=True),
        _outlet_col(),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("pin_hash", sa.String(128), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_staff_pins_outlet_id", "staff_pins", ["outlet_id"])

    # ---- growth services ----
    op.create_table(
        "service_catalog",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("key", sa.String(40), nullable=False, unique=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("tagline", sa.String(160), nullable=False),
        sa.Column("description_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("deliverables", pg.JSONB(), nullable=False, server_default="[]"),
        sa.Column("questions", pg.JSONB(), nullable=False, server_default="[]"),
        sa.Column("lead_time_days", sa.Integer()),
        sa.Column("cover_image_url", sa.String()),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "service_requests",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("account_id", UUID, sa.ForeignKey("accounts.id"), nullable=False),
        _outlet_col(),
        sa.Column("service_id", UUID, sa.ForeignKey("service_catalog.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="requested"),
        sa.Column("brief", sa.Text()),
        sa.Column("answers", pg.JSONB()),
        sa.Column("quoted_amount_minor", sa.Integer()),
        sa.Column("currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        _ts(),
        _ts("updated_at"),
    )
    op.create_index("ix_service_requests_account_id", "service_requests", ["account_id"])
    op.create_index("ix_service_requests_outlet_id", "service_requests", ["outlet_id"])
    op.create_index("ix_service_requests_status", "service_requests", ["status"])
    op.create_table(
        "service_request_events",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("request_id", UUID, sa.ForeignKey("service_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("actor", sa.String(8), nullable=False),
        _ts(),
    )
    op.create_index("ix_service_request_events_request_id", "service_request_events", ["request_id"])


def downgrade() -> None:
    for table in (
        "service_request_events",
        "service_requests",
        "service_catalog",
        "staff_pins",
        "loyalty_reward_grants",
        "loyalty_ledger",
        "loyalty_members",
        "loyalty_rewards",
        "loyalty_badges",
        "loyalty_programs",
        "print_kit_orders",
        "menu_items",
        "menu_categories",
        "outlet_links",
        "outlet_profiles",
    ):
        op.drop_table(table)
    op.drop_column("outlet_modules", "available")
