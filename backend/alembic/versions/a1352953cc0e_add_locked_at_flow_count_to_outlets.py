"""add locked_at_flow_count to outlets

Revision ID: a1352953cc0e
Revises: 255eebb1473d
Create Date: 2026-09-25 03:57:08.215556

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1352953cc0e'
down_revision: Union[str, None] = '255eebb1473d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outlets', sa.Column('locked_at_flow_count', sa.Integer(), nullable=True))
    # NOTE: autogenerate again proposed dropping the hand-authored composite/
    # partial indexes not declared on model metadata (see the note in
    # 255eebb1473d) — omitted deliberately, same as before.


def downgrade() -> None:
    op.drop_column('outlets', 'locked_at_flow_count')
