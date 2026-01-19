"""Add webhook hardening: idempotency_key to bank_events, webhook_dlq table

Revision ID: 020_add_webhook_hardening
Revises: 019_add_payment_profile
Create Date: 2026-01-19

TASK-1.2: Webhook Handler Hardening
- Adds idempotency_key column to bank_events for deduplication
- Creates webhook_dlq table for Dead Letter Queue
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '020_add_webhook_hardening'
down_revision = '019_add_payment_profile'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add idempotency_key to bank_events
    op.add_column(
        'bank_events',
        sa.Column('idempotency_key', sa.String(255), nullable=True)
    )
    op.create_index(
        'ix_bank_events_idempotency_key',
        'bank_events',
        ['idempotency_key'],
        unique=True
    )

    # Create webhook_dlq table
    op.create_table(
        'webhook_dlq',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),

        # Event identification
        sa.Column('event_type', sa.String(100), nullable=False, index=True),

        # Original payload
        sa.Column('payload', postgresql.JSONB(), nullable=False),

        # Error details
        sa.Column('error_message', sa.Text(), nullable=False),

        # Retry tracking
        sa.Column('retry_count', sa.Integer(), default=0, nullable=False),
        sa.Column('last_retry_at', sa.DateTime(), nullable=True),

        # Resolution
        sa.Column('resolved_at', sa.DateTime(), nullable=True, index=True),

        # Optional link to deal
        sa.Column('deal_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lk_deals.id'), nullable=True, index=True),
    )


def downgrade() -> None:
    # Drop webhook_dlq table
    op.drop_table('webhook_dlq')

    # Remove idempotency_key from bank_events
    op.drop_index('ix_bank_events_idempotency_key', table_name='bank_events')
    op.drop_column('bank_events', 'idempotency_key')
