"""Add client passport fields to deals

Revision ID: 029_add_client_passport_fields
Revises: 028_merge_027_heads
Create Date: 2026-01-19

Adds encrypted passport fields for client data (152-FZ compliance):
- passport_series, passport_number (encrypted)
- passport_hash (for duplicate detection)
- passport_issued_by, issued_date, issued_code
- birth_date, birth_place
- registration_address

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '029_add_client_passport_fields'
down_revision = '028_merge_027_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add client passport fields to lk_deals
    op.add_column('lk_deals', sa.Column('client_passport_series_encrypted', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('client_passport_number_encrypted', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('client_passport_hash', sa.String(64), nullable=True))
    op.add_column('lk_deals', sa.Column('client_passport_issued_by_encrypted', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('client_passport_issued_date', sa.DateTime(), nullable=True))
    op.add_column('lk_deals', sa.Column('client_passport_issued_code', sa.String(10), nullable=True))
    op.add_column('lk_deals', sa.Column('client_birth_date', sa.DateTime(), nullable=True))
    op.add_column('lk_deals', sa.Column('client_birth_place_encrypted', sa.String(500), nullable=True))
    op.add_column('lk_deals', sa.Column('client_registration_address_encrypted', sa.Text(), nullable=True))

    # Create index on passport hash for duplicate detection
    op.create_index(
        'ix_lk_deals_client_passport_hash',
        'lk_deals',
        ['client_passport_hash'],
        unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_lk_deals_client_passport_hash', table_name='lk_deals')
    op.drop_column('lk_deals', 'client_registration_address_encrypted')
    op.drop_column('lk_deals', 'client_birth_place_encrypted')
    op.drop_column('lk_deals', 'client_birth_date')
    op.drop_column('lk_deals', 'client_passport_issued_code')
    op.drop_column('lk_deals', 'client_passport_issued_date')
    op.drop_column('lk_deals', 'client_passport_issued_by_encrypted')
    op.drop_column('lk_deals', 'client_passport_hash')
    op.drop_column('lk_deals', 'client_passport_number_encrypted')
    op.drop_column('lk_deals', 'client_passport_series_encrypted')
