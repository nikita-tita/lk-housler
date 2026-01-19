"""Merge 022 migration heads

Revision ID: 023_merge_022_heads
Revises: 022_add_contract_layer, 022_add_fiscalization_settings
Create Date: 2026-01-19

Merges two parallel branches from Week 3:
- TASK-3.1: Fiscalization Infrastructure
- TASK-4.1: Contract Layer Separation

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '023_merge_022_heads'
down_revision = ('022_add_contract_layer', '022_add_fiscalization_settings')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass
