"""Add signed_contracts and contract_signatures tables

Revision ID: 012_add_signed_contracts
Revises: 011_add_split_adjustments
Create Date: 2026-01-17 15:00:00.000000

This migration adds tables for managing bank-split contracts:
- signed_contracts: Contract instances generated from templates
- contract_signatures: Individual signatures on contracts
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '012_add_signed_contracts'
down_revision: Union[str, None] = '011_add_split_adjustments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create signed_contracts table
    op.create_table(
        'signed_contracts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('template_id', UUID(as_uuid=True), sa.ForeignKey('contract_templates.id'), nullable=False),

        # Contract details
        sa.Column('contract_number', sa.String(50), nullable=False, unique=True),
        sa.Column('contract_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(30), server_default='draft', nullable=False),

        # Generated content
        sa.Column('html_content', sa.Text, nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),
        sa.Column('document_hash', sa.String(64), nullable=True),

        # Contract data
        sa.Column('contract_data', JSONB, nullable=False),

        # Financial terms
        sa.Column('commission_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('platform_fee', sa.Numeric(15, 2), nullable=True),
        sa.Column('split_percent_agent', sa.Numeric(5, 2), nullable=True),
        sa.Column('split_percent_agency', sa.Numeric(5, 2), nullable=True),

        # Signers
        sa.Column('required_signers', JSONB, nullable=False),

        # Timestamps
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create indexes for signed_contracts
    op.create_index('ix_signed_contracts_deal_id', 'signed_contracts', ['deal_id'])
    op.create_index('ix_signed_contracts_status', 'signed_contracts', ['status'])
    op.create_index('ix_signed_contracts_contract_number', 'signed_contracts', ['contract_number'])

    # Create contract_signatures table
    op.create_table(
        'contract_signatures',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),

        # Foreign keys
        sa.Column('contract_id', UUID(as_uuid=True), sa.ForeignKey('signed_contracts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),

        # Signer info
        sa.Column('signer_name', sa.String(255), nullable=False),
        sa.Column('signer_role', sa.String(50), nullable=False),

        # Signature data
        sa.Column('signed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('signature_method', sa.String(20), server_default='pep_sms', nullable=False),

        # Evidence
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('otp_verified', sa.Boolean, server_default='false', nullable=False),
        sa.Column('otp_phone', sa.String(20), nullable=True),
    )

    # Create indexes for contract_signatures
    op.create_index('ix_contract_signatures_contract_id', 'contract_signatures', ['contract_id'])
    op.create_index('ix_contract_signatures_user_id', 'contract_signatures', ['user_id'])


def downgrade() -> None:
    # Drop contract_signatures
    op.drop_index('ix_contract_signatures_user_id', 'contract_signatures')
    op.drop_index('ix_contract_signatures_contract_id', 'contract_signatures')
    op.drop_table('contract_signatures')

    # Drop signed_contracts
    op.drop_index('ix_signed_contracts_contract_number', 'signed_contracts')
    op.drop_index('ix_signed_contracts_status', 'signed_contracts')
    op.drop_index('ix_signed_contracts_deal_id', 'signed_contracts')
    op.drop_table('signed_contracts')
