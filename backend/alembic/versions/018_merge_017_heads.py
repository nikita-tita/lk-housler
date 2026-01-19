"""Merge 017 migration heads

Revision ID: 018_merge_017_heads
Revises: 017_bank_status_idempotency, 017_hold_period_fields
Create Date: 2026-01-19

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '018_merge_017_heads'
down_revision = ('017_bank_status_idempotency', '017_hold_period_fields')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass
