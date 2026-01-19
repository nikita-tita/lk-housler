"""Add fiscalization_settings table

Revision ID: 022_add_fiscalization_settings
Revises: 021_merge_020_heads
Create Date: 2026-01-19

TASK-3.1: Fiscalization Infrastructure
- Creates fiscalization_settings table for configuring fiscalization methods
  per legal type and deal type combination
- Supports NPD receipts, T-Bank checks, external systems

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '022_add_fiscalization_settings'
down_revision = '021_merge_020_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create fiscalization_settings table
    op.create_table(
        'fiscalization_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),

        # Configuration key
        sa.Column('legal_type', sa.String(20), nullable=False),  # se, ip, ooo, platform
        sa.Column('deal_type', sa.String(50), nullable=True),  # DealType or None for default

        # Fiscalization method
        sa.Column('method', sa.String(30), nullable=False, default='not_required'),

        # Requirements
        sa.Column('is_required', sa.Boolean(), nullable=False, default=False),
        sa.Column('min_amount_threshold', sa.Integer(), nullable=True),  # Min amount (kopeks)
        sa.Column('max_amount_threshold', sa.Integer(), nullable=True),  # Max amount (kopeks)

        # Provider configuration
        sa.Column('provider_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),

        # Feature flags
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('priority', sa.Integer(), nullable=False, default=0),

        # Description
        sa.Column('description', sa.Text(), nullable=True),

        # Unique constraint
        sa.UniqueConstraint('legal_type', 'deal_type', name='uq_fiscalization_settings_legal_deal'),
    )

    # Create index on is_active for filtering
    op.create_index(
        'ix_fiscalization_settings_is_active',
        'fiscalization_settings',
        ['is_active']
    )

    # Create index on legal_type for lookups
    op.create_index(
        'ix_fiscalization_settings_legal_type',
        'fiscalization_settings',
        ['legal_type']
    )

    # Insert default fiscalization settings
    op.execute("""
        INSERT INTO fiscalization_settings (id, legal_type, deal_type, method, is_required, is_active, priority, description, created_at, updated_at)
        VALUES
        -- Self-employed default: NPD receipts required
        (gen_random_uuid(), 'se', NULL, 'npd_receipt', true, true, 0, 'Self-employed agents use NPD receipts via MyNalog', NOW(), NOW()),

        -- Individual entrepreneur default: T-Bank checks or external
        (gen_random_uuid(), 'ip', NULL, 'tbank_checks', true, true, 0, 'IP uses T-Bank fiscal receipts', NOW(), NOW()),

        -- LLC default: T-Bank checks or external
        (gen_random_uuid(), 'ooo', NULL, 'tbank_checks', true, true, 0, 'OOO uses T-Bank fiscal receipts', NOW(), NOW()),

        -- Platform fees: no fiscalization required (platform handles own)
        (gen_random_uuid(), 'platform', NULL, 'not_required', false, true, 0, 'Platform fees handled separately', NOW(), NOW())
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_fiscalization_settings_legal_type', table_name='fiscalization_settings')
    op.drop_index('ix_fiscalization_settings_is_active', table_name='fiscalization_settings')

    # Drop table
    op.drop_table('fiscalization_settings')
