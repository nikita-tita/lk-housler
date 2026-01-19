"""Add fiscal_receipts table for T-Bank Checks integration

Revision ID: 025_add_fiscal_receipts
Revises: 024_update_contract_templates_v2
Create Date: 2026-01-19

TASK-3.2: T-Bank Checks Integration

This migration creates the fiscal_receipts table for tracking fiscal receipts
generated through T-Bank Checks API when releasing bank-split deals.

Features:
- Link to deals (deal_id)
- Receipt type (income/income_return)
- External ID from T-Bank
- Status tracking (pending/created/failed/cancelled)
- Fiscal data storage (FN, FD, FP numbers)
- Retry tracking for failed receipts
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '025_add_fiscal_receipts'
down_revision: Union[str, None] = '024_update_contract_templates_v2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create fiscal_receipts table
    op.create_table(
        'fiscal_receipts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Link to deal
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),

        # Receipt type (income, income_return)
        sa.Column('type', sa.String(30), nullable=False, server_default='income'),

        # Amount in kopeks
        sa.Column('amount', sa.Integer, nullable=False),

        # External ID from T-Bank
        sa.Column('external_id', sa.String(100), nullable=True),

        # Status (pending, created, failed, cancelled)
        sa.Column('status', sa.String(30), nullable=False, server_default='pending'),

        # Receipt URL (link to PDF from T-Bank)
        sa.Column('receipt_url', sa.String(500), nullable=True),

        # Fiscal data (FN, FD, FP numbers)
        sa.Column('fiscal_data', JSONB, nullable=True),

        # Client info
        sa.Column('client_email', sa.String(255), nullable=True),
        sa.Column('client_phone', sa.String(20), nullable=True),

        # Error info
        sa.Column('error_code', sa.String(50), nullable=True),
        sa.Column('error_message', sa.Text, nullable=True),

        # Timestamps
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),

        # Retry tracking
        sa.Column('retry_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_retry_at', sa.DateTime(timezone=True), nullable=True),

        # Original receipt (for income_return refunds)
        sa.Column('original_receipt_id', UUID(as_uuid=True), sa.ForeignKey('fiscal_receipts.id'), nullable=True),

        # Metadata
        sa.Column('meta', JSONB, nullable=True),
    )

    # Create indexes
    op.create_index('ix_fiscal_receipts_deal_id', 'fiscal_receipts', ['deal_id'])
    op.create_index('ix_fiscal_receipts_external_id', 'fiscal_receipts', ['external_id'])
    op.create_index('ix_fiscal_receipts_status', 'fiscal_receipts', ['status'])

    # Create composite index for finding failed receipts to retry
    op.create_index(
        'ix_fiscal_receipts_status_retry',
        'fiscal_receipts',
        ['status', 'retry_count'],
        postgresql_where=sa.text("status = 'failed'")
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_fiscal_receipts_status_retry', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_status', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_external_id', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_deal_id', table_name='fiscal_receipts')

    # Drop table
    op.drop_table('fiscal_receipts')
