"""hub_mode, outlet_modules, referral tables

Revision ID: c3a9e5d17b42
Revises: b7d41c2e9f10
Create Date: 2026-10-01 10:00:00

Hand-written. Reserves the hub schema (22-HUB-AND-MODULES.md section 9) and adds
the owner-referral ledger (70% off once the referred outlet actually pays).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c3a9e5d17b42'
down_revision: Union[str, None] = 'b7d41c2e9f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'outlets',
        sa.Column('hub_mode', sa.String(), nullable=False, server_default='direct'),
    )

    op.create_table(
        'outlet_modules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('outlet_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outlets.id'), nullable=False),
        sa.Column('module', sa.String(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('config', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('outlet_id', 'module', name='uq_outlet_modules_outlet_module'),
    )
    op.create_index('ix_outlet_modules_outlet_id', 'outlet_modules', ['outlet_id'])

    op.add_column('accounts', sa.Column('referral_code', sa.String(), nullable=True))
    op.create_index('ix_accounts_referral_code', 'accounts', ['referral_code'], unique=True)
    op.add_column('accounts', sa.Column('referred_by_account_id', postgresql.UUID(as_uuid=True), nullable=True))

    op.create_table(
        'referral_rewards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('referrer_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounts.id'), nullable=False),
        sa.Column('referred_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounts.id'), nullable=False, unique=True),
        # pending (signed up, not yet paid) | earned (referee paid) | applied | void
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('discount_percent', sa.Integer(), nullable=False, server_default='70'),
        sa.Column('earned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_referral_rewards_referrer', 'referral_rewards', ['referrer_account_id'])

    op.create_table(
        'leads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('place_id', sa.String(), nullable=False),
        sa.Column('business_name', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=False, server_default='gap_report'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_leads_email', 'leads', ['email'])


def downgrade() -> None:
    op.drop_table('leads')
    op.drop_table('referral_rewards')
    op.drop_column('accounts', 'referred_by_account_id')
    op.drop_index('ix_accounts_referral_code', table_name='accounts')
    op.drop_column('accounts', 'referral_code')
    op.drop_table('outlet_modules')
    op.drop_column('outlets', 'hub_mode')
