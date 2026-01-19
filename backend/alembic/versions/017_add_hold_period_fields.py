"""Add configurable hold period fields to lk_deals

Revision ID: 017_hold_period_fields
Revises: 016_contract_template_fields
Create Date: 2026-01-19

TASK-2.1: Configurable Hold Period
- hold_duration_hours: dispute window (default 72h)
- auto_release_days: auto-release if no disputes (default 7d)
- hold_started_at: when hold period started
- auto_release_at: computed release timestamp

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '017_hold_period_fields'
down_revision = '016_contract_template_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add configurable hold period fields
    # Using server_default for existing rows, nullable=False for new fields with defaults
    op.add_column('lk_deals', sa.Column(
        'hold_duration_hours',
        sa.Integer(),
        nullable=False,
        server_default='72'
    ))
    op.add_column('lk_deals', sa.Column(
        'auto_release_days',
        sa.Integer(),
        nullable=False,
        server_default='7'
    ))
    op.add_column('lk_deals', sa.Column(
        'hold_started_at',
        sa.DateTime(),
        nullable=True
    ))
    op.add_column('lk_deals', sa.Column(
        'auto_release_at',
        sa.DateTime(),
        nullable=True
    ))


def downgrade() -> None:
    op.drop_column('lk_deals', 'auto_release_at')
    op.drop_column('lk_deals', 'hold_started_at')
    op.drop_column('lk_deals', 'auto_release_days')
    op.drop_column('lk_deals', 'hold_duration_hours')
