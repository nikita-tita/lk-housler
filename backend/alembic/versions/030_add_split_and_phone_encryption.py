"""Add split fields and phone encryption

Revision ID: 030_add_split_and_phone_encryption
Revises: 029_add_client_passport_fields
Create Date: 2026-01-20

TASK-002: Add commission split fields
- agent_split_percent, coagent_split_percent, agency_split_percent
- coagent_user_id, coagent_phone

TASK-004: Add phone encryption for 152-FZ compliance
- client_phone_encrypted, client_phone_hash

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '030_add_split_and_phone_encryption'
down_revision = '029_add_client_passport_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # TASK-002: Split fields
    op.add_column('lk_deals', sa.Column('agent_split_percent', sa.Integer(), nullable=True))
    op.add_column('lk_deals', sa.Column('coagent_split_percent', sa.Integer(), nullable=True))
    op.add_column('lk_deals', sa.Column('coagent_user_id', sa.Integer(), nullable=True))
    op.add_column('lk_deals', sa.Column('coagent_phone', sa.String(20), nullable=True))
    op.add_column('lk_deals', sa.Column('agency_split_percent', sa.Integer(), nullable=True))

    # FK for coagent_user_id
    op.create_foreign_key(
        'fk_lk_deals_coagent_user_id',
        'lk_deals', 'users',
        ['coagent_user_id'], ['id'],
        ondelete='SET NULL'
    )

    # TASK-004: Phone encryption
    op.add_column('lk_deals', sa.Column('client_phone_encrypted', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('client_phone_hash', sa.String(64), nullable=True))

    # Index for phone lookup
    op.create_index('ix_lk_deals_client_phone_hash', 'lk_deals', ['client_phone_hash'])


def downgrade() -> None:
    op.drop_index('ix_lk_deals_client_phone_hash', table_name='lk_deals')
    op.drop_column('lk_deals', 'client_phone_hash')
    op.drop_column('lk_deals', 'client_phone_encrypted')
    op.drop_constraint('fk_lk_deals_coagent_user_id', 'lk_deals', type_='foreignkey')
    op.drop_column('lk_deals', 'agency_split_percent')
    op.drop_column('lk_deals', 'coagent_phone')
    op.drop_column('lk_deals', 'coagent_user_id')
    op.drop_column('lk_deals', 'coagent_split_percent')
    op.drop_column('lk_deals', 'agent_split_percent')
