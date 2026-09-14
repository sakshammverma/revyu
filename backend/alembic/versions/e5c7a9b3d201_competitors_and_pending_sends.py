"""competitor watch tables; click-to-chat body/phone on notifications

Revision ID: e5c7a9b3d201
Revises: d4b8f1a2c6e0
Create Date: 2026-10-01 16:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e5c7a9b3d201'
down_revision: Union[str, None] = 'd4b8f1a2c6e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'competitor_watches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('outlet_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('outlets.id'), nullable=False),
        sa.Column('place_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('outlet_id', 'place_id', name='uq_competitor_watch_outlet_place'),
    )
    op.create_index('ix_competitor_watches_outlet_id', 'competitor_watches', ['outlet_id'])

    op.create_table(
        'competitor_snapshots',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column('watch_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('competitor_watches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.Numeric(2, 1), nullable=True),
        sa.Column('review_count', sa.Integer(), nullable=True),
        sa.Column('polled_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_competitor_snapshots_watch_polled', 'competitor_snapshots', ['watch_id', 'polled_at'])

    op.add_column('notifications', sa.Column('to_phone', sa.String(), nullable=True))
    op.add_column('notifications', sa.Column('body', sa.Text(), nullable=True))
    op.add_column('notifications', sa.Column(
        'created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_column('notifications', 'created_at')
    op.drop_column('notifications', 'body')
    op.drop_column('notifications', 'to_phone')
    op.drop_table('competitor_snapshots')
    op.drop_table('competitor_watches')
