"""Merge 020 migration heads

Revision ID: 021_merge_020_heads
Revises: 020_add_service_completion_release_fields, 020_dispute_lock, 020_add_webhook_hardening
Create Date: 2026-01-19

Merges three parallel branches from Week 2:
- TASK-1.2: Webhook Handler Hardening
- TASK-2.2: Release by Confirmation Event
- TASK-2.3: Dispute Lock Mechanism

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '021_merge_020_heads'
down_revision = ('020_add_service_completion_release_fields', '020_dispute_lock', '020_add_webhook_hardening')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge migration - no changes needed
    pass


def downgrade() -> None:
    # Merge migration - no changes needed
    pass
