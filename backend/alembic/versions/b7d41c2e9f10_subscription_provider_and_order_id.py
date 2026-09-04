"""subscription provider + razorpay_order_id

Revision ID: b7d41c2e9f10
Revises: 9c5c7251639c
Create Date: 2026-09-25 14:00:00

Hand-written (DB unavailable for autogenerate). Adds what signup checkout
needs: which provider owns the row, and the one-time order id so order.paid
webhooks can resolve their subscription.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d41c2e9f10'
down_revision: Union[str, None] = '9c5c7251639c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'subscriptions',
        sa.Column('provider', sa.String(), nullable=False, server_default='razorpay'),
    )
    op.add_column('subscriptions', sa.Column('razorpay_order_id', sa.String(), nullable=True))
    op.create_index(
        'ix_subscriptions_razorpay_subscription_id', 'subscriptions', ['razorpay_subscription_id']
    )
    op.create_index('ix_subscriptions_razorpay_order_id', 'subscriptions', ['razorpay_order_id'])


def downgrade() -> None:
    op.drop_index('ix_subscriptions_razorpay_order_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_razorpay_subscription_id', table_name='subscriptions')
    op.drop_column('subscriptions', 'razorpay_order_id')
    op.drop_column('subscriptions', 'provider')
