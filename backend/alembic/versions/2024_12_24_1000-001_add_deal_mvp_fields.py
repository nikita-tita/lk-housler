"""Create deals tables and add MVP fields

Revision ID: 001_add_deal_mvp_fields
Revises:
Create Date: 2024-12-24 10:00:00.000000

Note: Uses INTEGER for user foreign keys because agent.housler.ru users table uses INTEGER IDs
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '001_add_deal_mvp_fields'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create deals table
    # Note: user IDs are INTEGER in agent.housler.ru database
    op.create_table(
        'deals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('created_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('agent_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('executor_type', sa.String(20), server_default='user', nullable=False),
        sa.Column('executor_id', sa.Integer, nullable=True),  # Can reference user or org
        sa.Column('client_id', sa.Integer, nullable=True),
        sa.Column('client_name', sa.String(255), nullable=True),
        sa.Column('client_phone', sa.String(20), nullable=True),
        sa.Column('status', sa.String(50), server_default='draft', nullable=False, index=True),
        sa.Column('property_address', sa.Text, nullable=True),
        sa.Column('price', sa.Numeric(15, 2), nullable=True),
        sa.Column('commission_agent', sa.Numeric(15, 2), nullable=True),
    )
    op.create_index('ix_deals_created_by_user_id', 'deals', ['created_by_user_id'])
    op.create_index('ix_deals_agent_user_id', 'deals', ['agent_user_id'])

    # Create deal_parties table
    op.create_table(
        'deal_parties',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('deals.id'), nullable=False),
        sa.Column('party_role', sa.String(50), nullable=False),
        sa.Column('party_type', sa.String(50), nullable=False),
        sa.Column('party_id', sa.Integer, nullable=True),  # User or org ID
        sa.Column('display_name_snapshot', sa.String(255), nullable=False),
        sa.Column('phone_snapshot', sa.String(20), nullable=True),
        sa.Column('passport_snapshot_hash', sa.String(64), nullable=True),
        sa.Column('signing_required', sa.Boolean, server_default='true', nullable=False),
        sa.Column('signing_order', sa.Integer, server_default='0', nullable=False),
    )
    op.create_index('ix_deal_parties_deal_id', 'deal_parties', ['deal_id'])

    # Create deal_terms table
    op.create_table(
        'deal_terms',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('deals.id'), nullable=False, unique=True),
        sa.Column('commission_total', sa.Numeric(15, 2), nullable=False),
        sa.Column('payment_plan', JSONB, nullable=False),
        sa.Column('split_rule', JSONB, nullable=False),
        sa.Column('milestone_rules', JSONB, nullable=True),
        sa.Column('cancellation_policy', JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_table('deal_terms')
    op.drop_table('deal_parties')
    op.drop_table('deals')
