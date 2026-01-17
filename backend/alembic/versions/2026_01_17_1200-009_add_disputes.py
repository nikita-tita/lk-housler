"""Add disputes tables

Revision ID: 009_add_disputes
Revises: 008_add_deal_invitations
Create Date: 2026-01-17 12:00:00.000000

This migration adds the disputes and dispute_evidence tables for
handling deal conflicts and refunds.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '009_add_disputes'
down_revision: Union[str, None] = '008_add_deal_invitations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create disputes table
    op.create_table(
        'disputes',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('initiator_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Dispute details
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('status', sa.String(20), server_default='open', nullable=False),

        # Resolution
        sa.Column('resolution', sa.String(50), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),
        sa.Column('resolved_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),

        # Refund tracking
        sa.Column('refund_requested', sa.Boolean, server_default='false', nullable=False),
        sa.Column('refund_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('refund_status', sa.String(20), server_default='not_requested', nullable=False),
        sa.Column('refund_external_id', sa.String(255), nullable=True),
        sa.Column('refund_processed_at', sa.DateTime(timezone=True), nullable=True),

        # Admin notes
        sa.Column('admin_notes', sa.Text, nullable=True),
    )

    # Create indexes
    op.create_index('ix_disputes_deal_id', 'disputes', ['deal_id'])
    op.create_index('ix_disputes_status', 'disputes', ['status'])
    op.create_index('ix_disputes_initiator', 'disputes', ['initiator_user_id'])

    # Create dispute_evidence table
    op.create_table(
        'dispute_evidence',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('dispute_id', UUID(as_uuid=True), sa.ForeignKey('disputes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('uploaded_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # File info
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('description', sa.Text, nullable=True),
    )

    # Create indexes
    op.create_index('ix_dispute_evidence_dispute_id', 'dispute_evidence', ['dispute_id'])


def downgrade() -> None:
    op.drop_index('ix_dispute_evidence_dispute_id', 'dispute_evidence')
    op.drop_table('dispute_evidence')

    op.drop_index('ix_disputes_initiator', 'disputes')
    op.drop_index('ix_disputes_status', 'disputes')
    op.drop_index('ix_disputes_deal_id', 'disputes')
    op.drop_table('disputes')
