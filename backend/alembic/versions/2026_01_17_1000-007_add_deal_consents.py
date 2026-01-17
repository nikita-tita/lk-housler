"""Add deal_consents table

Revision ID: 007_add_deal_consents
Revises: 006_add_bank_split_tables
Create Date: 2026-01-17 10:00:00.000000

This migration adds the deal_consents table for tracking user agreements
to platform commission, data processing, and terms of service.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '007_add_deal_consents'
down_revision: Union[str, None] = '006_add_bank_split_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create deal_consents table
    op.create_table(
        'deal_consents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),

        # Consent details
        sa.Column('consent_type', sa.String(50), nullable=False),
        sa.Column('consent_version', sa.String(20), server_default='1.0', nullable=False),

        # When and how consent was given
        sa.Column('agreed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),

        # Reference to what was agreed to
        sa.Column('document_url', sa.String(500), nullable=True),
        sa.Column('document_hash', sa.String(64), nullable=True),

        # Withdrawal
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_reason', sa.Text, nullable=True),
    )

    # Create indexes
    op.create_index('ix_deal_consents_deal_id', 'deal_consents', ['deal_id'])
    op.create_index('ix_deal_consents_user_id', 'deal_consents', ['user_id'])
    op.create_index('ix_deal_consents_consent_type', 'deal_consents', ['consent_type'])

    # Unique constraint: one active consent per user per deal per type
    op.create_index(
        'uq_deal_consents_active',
        'deal_consents',
        ['deal_id', 'user_id', 'consent_type'],
        unique=True,
        postgresql_where=sa.text('revoked_at IS NULL')
    )


def downgrade() -> None:
    op.drop_index('uq_deal_consents_active', 'deal_consents')
    op.drop_index('ix_deal_consents_consent_type', 'deal_consents')
    op.drop_index('ix_deal_consents_user_id', 'deal_consents')
    op.drop_index('ix_deal_consents_deal_id', 'deal_consents')
    op.drop_table('deal_consents')
