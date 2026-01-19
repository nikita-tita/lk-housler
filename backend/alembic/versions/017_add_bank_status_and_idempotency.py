"""Add bank status fields to Deal and create IdempotencyKey table

Revision ID: 017_bank_status_idempotency
Revises: 016_contract_template_fields
Create Date: 2026-01-19

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '017_bank_status_idempotency'
down_revision = '016_contract_template_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add bank status fields to lk_deals
    op.add_column('lk_deals', sa.Column(
        'bank_status',
        sa.String(30),
        server_default='not_created',
        nullable=False
    ))
    op.add_column('lk_deals', sa.Column('bank_created_at', sa.DateTime(), nullable=True))
    op.add_column('lk_deals', sa.Column('bank_released_at', sa.DateTime(), nullable=True))

    # Create idempotency_keys table
    op.create_table(
        'idempotency_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('key', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('operation', sa.String(50), nullable=False),
        sa.Column('deal_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('response_json', postgresql.JSONB(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Composite index for efficient lookups
    op.create_index(
        'ix_idempotency_keys_deal_operation',
        'idempotency_keys',
        ['deal_id', 'operation']
    )


def downgrade() -> None:
    # Drop idempotency_keys table
    op.drop_index('ix_idempotency_keys_deal_operation', table_name='idempotency_keys')
    op.drop_table('idempotency_keys')

    # Drop bank status fields from lk_deals
    op.drop_column('lk_deals', 'bank_released_at')
    op.drop_column('lk_deals', 'bank_created_at')
    op.drop_column('lk_deals', 'bank_status')
