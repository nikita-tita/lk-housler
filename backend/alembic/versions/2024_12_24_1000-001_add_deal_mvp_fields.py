"""Add MVP fields to deals table

Revision ID: 001_add_deal_mvp_fields
Revises:
Create Date: 2024-12-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_add_deal_mvp_fields'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to deals table for MVP
    op.add_column('deals', sa.Column('client_name', sa.String(255), nullable=True))
    op.add_column('deals', sa.Column('client_phone', sa.String(20), nullable=True))
    op.add_column('deals', sa.Column('price', sa.Numeric(15, 2), nullable=True))
    op.add_column('deals', sa.Column('commission_agent', sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    # Remove MVP fields
    op.drop_column('deals', 'commission_agent')
    op.drop_column('deals', 'price')
    op.drop_column('deals', 'client_phone')
    op.drop_column('deals', 'client_name')
