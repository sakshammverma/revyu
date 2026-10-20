"""country pricing: tiers, country map, tier-keyed plans

Revision ID: b8f4d2e6a193
Revises: a7e3c91d4b05
Create Date: 2026-10-21 12:00:00

Hand-written.

Prices vary by purchasing-power tier and currency, not by country row. A
business's country (from its Google listing) maps to a tier + currency through
`country_pricing`; `plans` holds one active row per (code, tier, currency).
`provider_plan_id` is the gateway's recurring-plan id for that price.
Country '*' is the fallback for countries with no row. Prices for tiers other
than India are seeded by `python -m app.seeds.plans` and edited from /admin.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b8f4d2e6a193"
down_revision: Union[str, None] = "a7e3c91d4b05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE pricing_tiers (
            code text PRIMARY KEY,
            name text NOT NULL
        )
        """
    )
    op.execute(
        """
        INSERT INTO pricing_tiers (code, name) VALUES
            ('tier1', 'High income'),
            ('tier2', 'Middle income'),
            ('tier3', 'Value markets')
        """
    )
    op.execute(
        """
        CREATE TABLE country_pricing (
            country_code text PRIMARY KEY,
            tier_code text NOT NULL REFERENCES pricing_tiers (code),
            currency_code varchar(3) NOT NULL,
            locale text NOT NULL,
            active boolean NOT NULL DEFAULT true
        )
        """
    )
    # India (launch market) and the '*' fallback. The rest of the map is seeded.
    op.execute(
        """
        INSERT INTO country_pricing (country_code, tier_code, currency_code, locale) VALUES
            ('IN', 'tier3', 'INR', 'en-IN'),
            ('*', 'tier1', 'USD', 'en-US')
        """
    )

    op.execute("ALTER TABLE plans ADD COLUMN tier_code text REFERENCES pricing_tiers (code)")
    op.execute("ALTER TABLE plans ADD COLUMN provider_plan_id text")
    op.execute("ALTER TABLE plans ALTER COLUMN country_code DROP NOT NULL")
    op.execute("UPDATE plans SET tier_code = 'tier3' WHERE country_code = 'IN'")
    op.execute("DROP INDEX ux_plans_code_country_active")
    op.execute(
        """
        CREATE UNIQUE INDEX ux_plans_code_tier_currency_active
        ON plans (code, tier_code, currency_code) WHERE active
        """
    )

    # New tables need RLS too (see a7e3c91d4b05).
    op.execute("ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE country_pricing ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("DROP INDEX ux_plans_code_tier_currency_active")
    op.execute("DELETE FROM plans WHERE country_code IS NULL OR country_code <> 'IN'")
    op.execute("UPDATE plans SET country_code = 'IN' WHERE country_code IS NULL")
    op.execute("ALTER TABLE plans ALTER COLUMN country_code SET NOT NULL")
    op.execute(
        """
        CREATE UNIQUE INDEX ux_plans_code_country_active
        ON plans (code, country_code) WHERE active
        """
    )
    op.execute("ALTER TABLE plans DROP COLUMN provider_plan_id")
    op.execute("ALTER TABLE plans DROP COLUMN tier_code")
    op.execute("DROP TABLE country_pricing")
    op.execute("DROP TABLE pricing_tiers")
