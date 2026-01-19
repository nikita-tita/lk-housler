"""Add contract layer field for two-layer architecture

Revision ID: 022_add_contract_layer
Revises: 021_merge_020_heads
Create Date: 2026-01-19

TASK-4.1: Contract Layer Separation
Разделение договорной структуры на два слоя:
- PLATFORM: Пользовательское соглашение (Terms of Service)
- TRANSACTION: Договоры между клиентом и исполнителем

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '022_add_contract_layer'
down_revision = '021_merge_020_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add layer column with default 'transaction' for existing records
    op.add_column(
        'contract_templates',
        sa.Column('layer', sa.String(20), nullable=False, server_default='transaction')
    )

    # Create index for faster layer-based queries
    op.create_index(
        'ix_contract_templates_layer',
        'contract_templates',
        ['layer']
    )

    # Update existing bank_split templates to transaction layer (already default)
    # Update user_agreement type to platform layer
    op.execute("""
        UPDATE contract_templates
        SET layer = 'platform'
        WHERE type = 'user_agreement'
    """)


def downgrade() -> None:
    op.drop_index('ix_contract_templates_layer', table_name='contract_templates')
    op.drop_column('contract_templates', 'layer')
