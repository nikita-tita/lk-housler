"""Add deal_invitations table

Revision ID: 008_add_deal_invitations
Revises: 007_add_deal_consents
Create Date: 2026-01-17 11:00:00.000000

This migration adds the deal_invitations table for multi-agent deal
partner invitations.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '008_add_deal_invitations'
down_revision: Union[str, None] = '007_add_deal_consents'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create deal_invitations table
    op.create_table(
        'deal_invitations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Deal and inviter
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invited_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Invited party identification
        sa.Column('invited_phone', sa.String(20), nullable=False),
        sa.Column('invited_email', sa.String(255), nullable=True),
        sa.Column('invited_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),

        # Role and split
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('split_percent', sa.Numeric(5, 2), nullable=False),

        # Invitation token
        sa.Column('token', sa.String(64), unique=True, nullable=False),

        # Status tracking
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),

        # Response tracking
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decline_reason', sa.Text, nullable=True),

        # SMS/Email delivery tracking
        sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('send_count', sa.Integer, server_default='0', nullable=False),
    )

    # Create indexes
    op.create_index('ix_deal_invitations_deal_id', 'deal_invitations', ['deal_id'])
    op.create_index('ix_deal_invitations_invited_phone', 'deal_invitations', ['invited_phone'])
    op.create_index('ix_deal_invitations_token', 'deal_invitations', ['token'])
    op.create_index('ix_deal_invitations_status', 'deal_invitations', ['status'])


def downgrade() -> None:
    op.drop_index('ix_deal_invitations_status', 'deal_invitations')
    op.drop_index('ix_deal_invitations_token', 'deal_invitations')
    op.drop_index('ix_deal_invitations_invited_phone', 'deal_invitations')
    op.drop_index('ix_deal_invitations_deal_id', 'deal_invitations')
    op.drop_table('deal_invitations')
