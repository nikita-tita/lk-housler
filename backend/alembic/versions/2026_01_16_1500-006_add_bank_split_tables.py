"""Add bank split tables and columns

Revision ID: 006_add_bank_split_tables
Revises: 005_create_lk_deals_tables
Create Date: 2026-01-16 15:00:00.000000

This migration adds support for T-Bank instant split payment model:
- New columns in lk_deals for bank integration
- New columns in payment_intents for bank status tracking
- New tables: deal_split_recipients, split_rule_templates, bank_events,
  self_employed_registry, evidence_files, deal_milestones
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '006_add_bank_split_tables'
down_revision: Union[str, None] = '005_create_lk_deals_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========================================
    # 1. Add bank split columns to lk_deals
    # ========================================
    op.add_column('lk_deals', sa.Column('payment_model', sa.String(30), server_default='mor', nullable=False))
    op.add_column('lk_deals', sa.Column('external_provider', sa.String(50), nullable=True))
    op.add_column('lk_deals', sa.Column('external_deal_id', sa.String(255), nullable=True))
    op.add_column('lk_deals', sa.Column('external_account_number', sa.String(50), nullable=True))
    op.add_column('lk_deals', sa.Column('payment_link_url', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('payment_qr_payload', sa.Text, nullable=True))
    op.add_column('lk_deals', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lk_deals', sa.Column('hold_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lk_deals', sa.Column('payer_email', sa.String(255), nullable=True))
    op.add_column('lk_deals', sa.Column('description', sa.Text, nullable=True))

    op.create_index('ix_lk_deals_external_deal_id', 'lk_deals', ['external_deal_id'])
    op.create_index('ix_lk_deals_payment_model', 'lk_deals', ['payment_model'])

    # ========================================
    # 2. Add bank split columns to payment_intents
    # ========================================
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_intents')"
    ))
    payment_intents_exists = result.scalar()

    if payment_intents_exists:
        op.add_column('payment_intents', sa.Column('external_payment_id', sa.String(255), nullable=True))
        op.add_column('payment_intents', sa.Column('bank_status', sa.String(50), nullable=True))
        op.add_column('payment_intents', sa.Column('bank_status_updated_at', sa.DateTime(timezone=True), nullable=True))
        op.create_index('ix_payment_intents_external_payment_id', 'payment_intents', ['external_payment_id'])

    # ========================================
    # 3. Create deal_split_recipients table
    # ========================================
    op.create_table(
        'deal_split_recipients',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('legal_type', sa.String(20), nullable=True),
        sa.Column('inn', sa.String(12), nullable=True),
        sa.Column('kpp', sa.String(9), nullable=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True),
        sa.Column('payout_account_id', UUID(as_uuid=True), sa.ForeignKey('payout_accounts.id'), nullable=True),
        sa.Column('external_beneficiary_id', sa.String(100), nullable=True),
        sa.Column('external_recipient_id', sa.String(100), nullable=True),
        sa.Column('split_type', sa.String(20), server_default='percent', nullable=False),
        sa.Column('split_value', sa.Numeric(10, 4), nullable=False),
        sa.Column('calculated_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('payout_status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_deal_split_recipients_deal_id', 'deal_split_recipients', ['deal_id'])
    op.create_index('ix_deal_split_recipients_payout_status', 'deal_split_recipients', ['payout_status'])

    # ========================================
    # 4. Create split_rule_templates table
    # ========================================
    op.create_table(
        'split_rule_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('applies_to_deal_types', JSONB, nullable=True),
        sa.Column('rules', JSONB, nullable=False),
        sa.Column('version', sa.Integer, server_default='1', nullable=False),
        sa.Column('is_active', sa.Boolean, server_default='true', nullable=False),
        sa.Column('created_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('approved_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_split_rule_templates_org_id', 'split_rule_templates', ['organization_id'])
    # Unique active code per organization
    op.create_index(
        'ix_split_rule_templates_active_code',
        'split_rule_templates',
        ['organization_id', 'code'],
        unique=True,
        postgresql_where=sa.text('is_active = true')
    )

    # ========================================
    # 5. Create bank_events table (immutable webhook log)
    # ========================================
    op.create_table(
        'bank_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=True),
        sa.Column('payment_intent_id', UUID(as_uuid=True), nullable=True),  # FK added conditionally below
        sa.Column('provider', sa.String(50), server_default='tbank', nullable=False),
        sa.Column('external_event_id', sa.String(255), nullable=True, unique=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('payload', JSONB, nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('signature_valid', sa.Boolean, nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processing_error', sa.Text, nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_bank_events_deal_id', 'bank_events', ['deal_id'])
    op.create_index('ix_bank_events_event_type', 'bank_events', ['event_type'])
    op.create_index('ix_bank_events_status', 'bank_events', ['status'])
    op.create_index('ix_bank_events_received_at', 'bank_events', ['received_at'])

    # Add FK to payment_intents if table exists
    if payment_intents_exists:
        op.create_foreign_key(
            'fk_bank_events_payment_intent',
            'bank_events', 'payment_intents',
            ['payment_intent_id'], ['id']
        )
        op.create_index('ix_bank_events_payment_intent_id', 'bank_events', ['payment_intent_id'])

    # ========================================
    # 6. Create self_employed_registry table
    # ========================================
    op.create_table(
        'self_employed_registry',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('inn', sa.String(12), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('external_recipient_id', sa.String(100), nullable=True),
        sa.Column('bank_status', sa.String(20), server_default='draft', nullable=False),
        sa.Column('npd_status', sa.String(50), nullable=True),
        sa.Column('npd_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('receipt_cancel_count', sa.Integer, server_default='0', nullable=False),
        sa.Column('last_receipt_cancel_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('risk_flag', sa.Boolean, server_default='false', nullable=False),
    )
    op.create_index('ix_self_employed_registry_org_id', 'self_employed_registry', ['organization_id'])
    op.create_index('ix_self_employed_registry_bank_status', 'self_employed_registry', ['bank_status'])
    op.create_index('ix_self_employed_registry_risk_flag', 'self_employed_registry', ['risk_flag'],
                    postgresql_where=sa.text('risk_flag = true'))
    # Unique user per organization
    op.create_unique_constraint('uq_self_employed_org_user', 'self_employed_registry', ['organization_id', 'user_id'])

    # ========================================
    # 7. Create evidence_files table
    # ========================================
    op.create_table(
        'evidence_files',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('uploaded_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('upload_ip', sa.String(45), nullable=True),
        sa.Column('upload_user_agent', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), server_default='uploaded', nullable=False),
        sa.Column('notes', sa.Text, nullable=True),
    )
    op.create_index('ix_evidence_files_deal_id', 'evidence_files', ['deal_id'])

    # ========================================
    # 8. Create deal_milestones table
    # ========================================
    op.create_table(
        'deal_milestones',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
        sa.Column('step_no', sa.Integer, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency', sa.String(3), server_default='RUB', nullable=False),
        sa.Column('trigger_type', sa.String(50), nullable=False),
        sa.Column('trigger_config', JSONB, nullable=True),
        sa.Column('external_step_id', sa.String(100), nullable=True),
        sa.Column('payment_link_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('hold_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('confirmed_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_deal_milestones_deal_id', 'deal_milestones', ['deal_id'])
    op.create_index('ix_deal_milestones_status', 'deal_milestones', ['status'])
    # Unique step per deal
    op.create_unique_constraint('uq_deal_milestone_step', 'deal_milestones', ['deal_id', 'step_no'])


def downgrade() -> None:
    # Drop new tables
    op.drop_table('deal_milestones')
    op.drop_table('evidence_files')
    op.drop_table('self_employed_registry')
    op.drop_table('bank_events')
    op.drop_table('split_rule_templates')
    op.drop_table('deal_split_recipients')

    # Remove columns from payment_intents
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_intents')"
    ))
    if result.scalar():
        op.drop_index('ix_payment_intents_external_payment_id', table_name='payment_intents')
        op.drop_column('payment_intents', 'bank_status_updated_at')
        op.drop_column('payment_intents', 'bank_status')
        op.drop_column('payment_intents', 'external_payment_id')

    # Remove columns from lk_deals
    op.drop_index('ix_lk_deals_payment_model', table_name='lk_deals')
    op.drop_index('ix_lk_deals_external_deal_id', table_name='lk_deals')
    op.drop_column('lk_deals', 'description')
    op.drop_column('lk_deals', 'payer_email')
    op.drop_column('lk_deals', 'hold_expires_at')
    op.drop_column('lk_deals', 'expires_at')
    op.drop_column('lk_deals', 'payment_qr_payload')
    op.drop_column('lk_deals', 'payment_link_url')
    op.drop_column('lk_deals', 'external_account_number')
    op.drop_column('lk_deals', 'external_deal_id')
    op.drop_column('lk_deals', 'external_provider')
    op.drop_column('lk_deals', 'payment_model')
