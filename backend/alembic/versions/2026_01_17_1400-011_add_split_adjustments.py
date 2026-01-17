"""Add split_adjustments table

Revision ID: 011_add_split_adjustments
Revises: 010_add_service_completions
Create Date: 2026-01-17 14:00:00.000000

This migration adds the split_adjustments table for tracking
requests to modify deal split percentages after creation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '011_add_split_adjustments'
down_revision: Union[str, None] = '010_add_service_completions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create split_adjustments table
    op.create_table(
        'split_adjustments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Split changes
        sa.Column('old_split', JSONB, nullable=False),
        sa.Column('new_split', JSONB, nullable=False),

        # Request details
        sa.Column('reason', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),

        # Approval tracking
        sa.Column('required_approvers', JSONB, nullable=False),
        sa.Column('approvals', JSONB, server_default='[]', nullable=False),
        sa.Column('rejections', JSONB, server_default='[]', nullable=False),

        # Timestamps
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes
    op.create_index('ix_split_adjustments_deal_id', 'split_adjustments', ['deal_id'])
    op.create_index('ix_split_adjustments_status', 'split_adjustments', ['status'])
    op.create_index('ix_split_adjustments_requested_by', 'split_adjustments', ['requested_by_user_id'])


def downgrade() -> None:
    op.drop_index('ix_split_adjustments_requested_by', 'split_adjustments')
    op.drop_index('ix_split_adjustments_status', 'split_adjustments')
    op.drop_index('ix_split_adjustments_deal_id', 'split_adjustments')
    op.drop_table('split_adjustments')
