"""Add milestone release fields for two-stage payments

Revision ID: 027_add_milestone_release_fields
Revises: 026_update_consent_types
Create Date: 2026-01-19

TASK-2.4: Two-Stage Payment (Milestones)

This migration adds new fields to deal_milestones table for supporting
different release triggers:
- release_trigger: Type of release trigger (immediate, short_hold, confirmation, date)
- release_delay_hours: Delay in hours for SHORT_HOLD trigger
- release_date: Target date for DATE trigger
- percent: Percentage of total deal
- release_requested_at: When release was requested
- release_scheduled_at: Scheduled release time
- release_error: Error message if release failed
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '027_add_milestone_release_fields'
down_revision: Union[str, None] = '026_update_consent_types'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to deal_milestones table

    # Percent of total deal
    op.add_column(
        'deal_milestones',
        sa.Column('percent', sa.Numeric(5, 2), nullable=True)
    )

    # Release trigger type
    op.add_column(
        'deal_milestones',
        sa.Column(
            'release_trigger',
            sa.String(20),
            server_default='confirmation',
            nullable=False
        )
    )

    # Release delay hours (for SHORT_HOLD trigger)
    op.add_column(
        'deal_milestones',
        sa.Column('release_delay_hours', sa.Integer, nullable=True)
    )

    # Release date (for DATE trigger)
    op.add_column(
        'deal_milestones',
        sa.Column('release_date', sa.DateTime(timezone=True), nullable=True)
    )

    # Release tracking fields
    op.add_column(
        'deal_milestones',
        sa.Column('release_requested_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.add_column(
        'deal_milestones',
        sa.Column('release_scheduled_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.add_column(
        'deal_milestones',
        sa.Column('release_error', sa.Text, nullable=True)
    )

    # Add index on release_trigger for filtering milestones by trigger type
    op.create_index(
        'ix_deal_milestones_release_trigger',
        'deal_milestones',
        ['release_trigger']
    )

    # Add index on release_scheduled_at for background task queries
    op.create_index(
        'ix_deal_milestones_release_scheduled',
        'deal_milestones',
        ['release_scheduled_at'],
        postgresql_where=sa.text("status = 'hold' AND release_scheduled_at IS NOT NULL")
    )

    # Add comment documenting the release_trigger values
    op.execute("""
        COMMENT ON COLUMN deal_milestones.release_trigger IS
        'Release trigger type: immediate (release after minimal hold),
        short_hold (release after N hours), confirmation (manual confirmation),
        date (release on specific date)';
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_deal_milestones_release_scheduled', table_name='deal_milestones')
    op.drop_index('ix_deal_milestones_release_trigger', table_name='deal_milestones')

    # Drop columns
    op.drop_column('deal_milestones', 'release_error')
    op.drop_column('deal_milestones', 'release_scheduled_at')
    op.drop_column('deal_milestones', 'release_requested_at')
    op.drop_column('deal_milestones', 'release_date')
    op.drop_column('deal_milestones', 'release_delay_hours')
    op.drop_column('deal_milestones', 'release_trigger')
    op.drop_column('deal_milestones', 'percent')
