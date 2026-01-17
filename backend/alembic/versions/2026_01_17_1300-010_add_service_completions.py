"""Add service_completions table

Revision ID: 010_add_service_completions
Revises: 009_add_disputes
Create Date: 2026-01-17 13:00:00.000000

This migration adds the service_completions table for tracking
when deal participants confirm that the service was completed satisfactorily.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '010_add_service_completions'
down_revision: Union[str, None] = '009_add_disputes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create service_completions table
    op.create_table(
        'service_completions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('confirmed_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Confirmation details
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('notes', sa.Text, nullable=True),

        # Evidence files (list of EvidenceFile IDs)
        sa.Column('evidence_file_ids', JSONB, nullable=True),

        # Client info at confirmation time
        sa.Column('client_ip', sa.String(45), nullable=True),
        sa.Column('client_user_agent', sa.Text, nullable=True),
    )

    # Create indexes
    op.create_index('ix_service_completions_deal_id', 'service_completions', ['deal_id'])
    op.create_index('ix_service_completions_confirmed_by', 'service_completions', ['confirmed_by_user_id'])


def downgrade() -> None:
    op.drop_index('ix_service_completions_confirmed_by', 'service_completions')
    op.drop_index('ix_service_completions_deal_id', 'service_completions')
    op.drop_table('service_completions')
