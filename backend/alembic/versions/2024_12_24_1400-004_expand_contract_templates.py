"""Expand contract_templates table with workflow fields

Revision ID: 004_expand_contract_templates
Revises: 003_add_signing_tokens
Create Date: 2024-12-24 14:00:00.000000

Adds columns for full template management:
- code, name, description for identification
- status, legal_basis, effective_from for workflow
- created_by, approved_by for audit
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_expand_contract_templates'
down_revision: Union[str, None] = '003_add_signing_tokens'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to contract_templates
    op.add_column('contract_templates', sa.Column('code', sa.String(50), nullable=True))
    op.add_column('contract_templates', sa.Column('name', sa.String(255), nullable=True))
    op.add_column('contract_templates', sa.Column('description', sa.Text, nullable=True))
    op.add_column('contract_templates', sa.Column('legal_basis', sa.Text, nullable=True))
    op.add_column('contract_templates', sa.Column('effective_from', sa.Date, nullable=True))
    op.add_column('contract_templates', sa.Column('status', sa.String(20), server_default='draft', nullable=False))
    op.add_column('contract_templates', sa.Column('published_at', sa.DateTime, nullable=True))
    op.add_column('contract_templates', sa.Column('created_by_user_id', sa.Integer, nullable=True))
    op.add_column('contract_templates', sa.Column('approved_by_user_id', sa.Integer, nullable=True))
    op.add_column('contract_templates', sa.Column('approved_at', sa.DateTime, nullable=True))

    # Add foreign keys
    op.create_foreign_key(
        'fk_contract_templates_created_by',
        'contract_templates', 'users',
        ['created_by_user_id'], ['id']
    )
    op.create_foreign_key(
        'fk_contract_templates_approved_by',
        'contract_templates', 'users',
        ['approved_by_user_id'], ['id']
    )

    # Add indexes
    op.create_index('ix_contract_templates_code', 'contract_templates', ['code'])
    op.create_index('ix_contract_templates_status', 'contract_templates', ['status'])

    # Update existing rows to have code = type
    op.execute("""
        UPDATE contract_templates
        SET code = type,
            name = CASE
                WHEN type = 'secondary_buy' THEN 'Договор на подбор (покупка)'
                WHEN type = 'secondary_sell' THEN 'Договор на продажу'
                WHEN type = 'newbuild_booking' THEN 'Договор на бронирование новостройки'
                WHEN type = 'act' THEN 'Акт оказанных услуг'
                ELSE type
            END
        WHERE code IS NULL
    """)

    # Make code and name non-nullable after update
    op.alter_column('contract_templates', 'code', nullable=False)
    op.alter_column('contract_templates', 'name', nullable=False)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_contract_templates_status', 'contract_templates')
    op.drop_index('ix_contract_templates_code', 'contract_templates')

    # Drop foreign keys
    op.drop_constraint('fk_contract_templates_approved_by', 'contract_templates', type_='foreignkey')
    op.drop_constraint('fk_contract_templates_created_by', 'contract_templates', type_='foreignkey')

    # Drop columns
    op.drop_column('contract_templates', 'approved_at')
    op.drop_column('contract_templates', 'approved_by_user_id')
    op.drop_column('contract_templates', 'created_by_user_id')
    op.drop_column('contract_templates', 'published_at')
    op.drop_column('contract_templates', 'status')
    op.drop_column('contract_templates', 'effective_from')
    op.drop_column('contract_templates', 'legal_basis')
    op.drop_column('contract_templates', 'description')
    op.drop_column('contract_templates', 'name')
    op.drop_column('contract_templates', 'code')
