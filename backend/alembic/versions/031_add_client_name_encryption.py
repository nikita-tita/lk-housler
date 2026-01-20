"""Add client_name encryption

Revision ID: 031_add_client_name_encryption
Revises: 030_add_split_and_phone_encryption
Create Date: 2026-01-20

TASK-011: Add client_name encryption for full 152-FZ compliance
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '031_add_client_name_encryption'
down_revision = '030_add_split_and_phone_encryption'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('lk_deals', sa.Column('client_name_encrypted', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('lk_deals', 'client_name_encrypted')
