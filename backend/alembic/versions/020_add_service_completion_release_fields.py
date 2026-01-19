"""Add release trigger fields to service_completions (TASK-2.2)

Revision ID: 020_add_service_completion_release_fields
Revises: 019_add_payment_profile
Create Date: 2026-01-19 12:00:00.000000

This migration adds:
- triggers_release: boolean indicating if this confirmation should trigger release
- release_triggered_at: timestamp when release was triggered
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '020_add_service_completion_release_fields'
down_revision: Union[str, None] = '019_add_payment_profile'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add triggers_release column with default True
    op.add_column(
        'service_completions',
        sa.Column('triggers_release', sa.Boolean(), nullable=False, server_default=sa.text('true'))
    )

    # Add release_triggered_at column
    op.add_column(
        'service_completions',
        sa.Column('release_triggered_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('service_completions', 'release_triggered_at')
    op.drop_column('service_completions', 'triggers_release')
