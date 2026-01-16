"""Create lk_deals and related tables

Revision ID: 005_create_lk_deals_tables
Revises: 004_expand_contract_templates
Create Date: 2025-01-16 22:00:00.000000

Note: This migration creates lk_deals table (instead of deals which conflicts with agent.housler.ru)
and related tables deal_parties, deal_terms with correct foreign keys.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '005_create_lk_deals_tables'
down_revision: Union[str, None] = '004_expand_contract_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if lk_deals exists, if not create it
    # Note: lk_deals may already exist from previous partial migration
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lk_deals')"
    ))
    lk_deals_exists = result.scalar()

    if not lk_deals_exists:
        op.create_table(
            'lk_deals',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('type', sa.String(50), nullable=False),
            sa.Column('created_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
            sa.Column('agent_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
            sa.Column('executor_type', sa.String(20), server_default='user', nullable=False),
            sa.Column('executor_id', sa.Integer, nullable=True),
            sa.Column('client_id', sa.Integer, nullable=True),
            sa.Column('client_name', sa.String(255), nullable=True),
            sa.Column('client_phone', sa.String(20), nullable=True),
            sa.Column('status', sa.String(50), server_default='draft', nullable=False, index=True),
            sa.Column('property_address', sa.Text, nullable=True),
            sa.Column('price', sa.Numeric(15, 2), nullable=True),
            sa.Column('commission_agent', sa.Numeric(15, 2), nullable=True),
        )
        op.create_index('ix_lk_deals_created_by_user_id', 'lk_deals', ['created_by_user_id'])
        op.create_index('ix_lk_deals_agent_user_id', 'lk_deals', ['agent_user_id'])
        op.create_index('ix_lk_deals_deleted_at', 'lk_deals', ['deleted_at'])

    # Check if deal_parties exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deal_parties')"
    ))
    deal_parties_exists = result.scalar()

    if not deal_parties_exists:
        op.create_table(
            'deal_parties',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
            sa.Column('party_role', sa.String(50), nullable=False),
            sa.Column('party_type', sa.String(50), nullable=False),
            sa.Column('party_id', sa.Integer, nullable=True),
            sa.Column('display_name_snapshot', sa.String(255), nullable=False),
            sa.Column('phone_snapshot', sa.String(20), nullable=True),
            sa.Column('passport_snapshot_hash', sa.String(64), nullable=True),
            sa.Column('signing_required', sa.Boolean, server_default='true', nullable=False),
            sa.Column('signing_order', sa.Integer, server_default='0', nullable=False),
        )
        op.create_index('ix_deal_parties_deal_id', 'deal_parties', ['deal_id'])

    # Check if deal_terms exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'deal_terms')"
    ))
    deal_terms_exists = result.scalar()

    if not deal_terms_exists:
        op.create_table(
            'deal_terms',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False, unique=True),
            sa.Column('commission_total', sa.Numeric(15, 2), nullable=False),
            sa.Column('payment_plan', JSONB, nullable=False),
            sa.Column('split_rule', JSONB, nullable=False),
            sa.Column('milestone_rules', JSONB, nullable=True),
            sa.Column('cancellation_policy', JSONB, nullable=True),
        )

    # Check if documents exists and has correct FK
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documents')"
    ))
    documents_exists = result.scalar()

    if not documents_exists:
        op.create_table(
            'documents',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
            sa.Column('template_id', UUID(as_uuid=True), sa.ForeignKey('contract_templates.id'), nullable=True),
            sa.Column('version_no', sa.Integer, server_default='1', nullable=False),
            sa.Column('status', sa.String(50), server_default='generated', nullable=False, index=True),
            sa.Column('file_url', sa.String(500), nullable=True),
            sa.Column('document_hash', sa.String(64), nullable=False, index=True),
        )
        op.create_index('ix_documents_deal_id', 'documents', ['deal_id'])

    # Check if payment_schedules exists
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_schedules')"
    ))
    payment_schedules_exists = result.scalar()

    if not payment_schedules_exists:
        op.create_table(
            'payment_schedules',
            sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
            sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
            sa.Column('step_no', sa.Integer, nullable=False),
            sa.Column('amount', sa.Numeric(15, 2), nullable=False),
            sa.Column('currency', sa.String(3), server_default='RUB', nullable=False),
            sa.Column('trigger_type', sa.String(50), nullable=False),
            sa.Column('trigger_meta', JSONB, nullable=True),
            sa.Column('status', sa.String(50), server_default='locked', nullable=False, index=True),
        )
        op.create_index('ix_payment_schedules_deal_id', 'payment_schedules', ['deal_id'])


def downgrade() -> None:
    op.drop_table('payment_schedules')
    op.drop_table('documents')
    op.drop_table('deal_terms')
    op.drop_table('deal_parties')
    op.drop_table('lk_deals')
