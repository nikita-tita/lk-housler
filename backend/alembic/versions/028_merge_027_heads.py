"""Merge 027 migration heads

Revision ID: 028_merge_027_heads
Revises: 027_add_milestone_release_fields, 027_add_npd_receipt_fields
Create Date: 2026-01-19

Merges Phase 8 parallel branches:
- TASK-2.4: Milestone release fields
- TASK-3.3: NPD receipt tracking fields

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '028_merge_027_heads'
down_revision = ('027_add_milestone_release_fields', '027_add_npd_receipt_fields')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass
