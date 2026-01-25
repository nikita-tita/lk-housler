"""Add deal_invoices table and payment_scheme to lk_deals

Revision ID: 014_add_deal_invoices
Revises: 013_fix_executor_id_type
Create Date: 2026-01-25 10:00:00.000000

This migration adds:
- deal_invoices: Multiple invoices per deal (advance, remainder, etc.)
- payment_scheme column to lk_deals for payment flow configuration

Supports scenarios:
1. Prepayment 100%: One invoice for full amount
2. Advance + postpay: Invoice for advance → service → invoice for remainder
3. Postpayment: Service → invoice for full amount
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '034_add_deal_invoices'
down_revision: Union[str, None] = '033_add_act_signing_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add payment_scheme column to lk_deals
    op.add_column(
        'lk_deals',
        sa.Column(
            'payment_scheme',
            sa.String(30),
            server_default='prepayment_full',
            nullable=False
        )
    )

    # Create deal_invoices table
    op.create_table(
        'deal_invoices',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('milestone_id', UUID(as_uuid=True), sa.ForeignKey('deal_milestones.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Invoice identification
        sa.Column('invoice_number', sa.String(50), nullable=True, unique=True),
        sa.Column('description', sa.String(500), nullable=True),

        # Amount
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='RUB', nullable=False),

        # T-Bank integration
        sa.Column('external_deal_id', sa.String(255), nullable=True),
        sa.Column('external_account_number', sa.String(50), nullable=True),
        sa.Column('payment_link_url', sa.String(500), nullable=True),
        sa.Column('payment_qr_payload', sa.Text, nullable=True),

        # Status and expiry
        sa.Column('status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),

        # Payment tracking
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_amount', sa.Numeric(15, 2), nullable=True),
    )

    # Create indexes
    op.create_index('ix_deal_invoices_deal_id', 'deal_invoices', ['deal_id'])
    op.create_index('ix_deal_invoices_milestone_id', 'deal_invoices', ['milestone_id'])
    op.create_index('ix_deal_invoices_status', 'deal_invoices', ['status'])
    op.create_index('ix_deal_invoices_external_deal_id', 'deal_invoices', ['external_deal_id'])


def downgrade() -> None:
    # Drop deal_invoices table
    op.drop_index('ix_deal_invoices_external_deal_id', 'deal_invoices')
    op.drop_index('ix_deal_invoices_status', 'deal_invoices')
    op.drop_index('ix_deal_invoices_milestone_id', 'deal_invoices')
    op.drop_index('ix_deal_invoices_deal_id', 'deal_invoices')
    op.drop_table('deal_invoices')

    # Remove payment_scheme column from lk_deals
    op.drop_column('lk_deals', 'payment_scheme')
