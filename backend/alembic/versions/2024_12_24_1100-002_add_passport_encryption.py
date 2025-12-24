"""Add encrypted fields for passport data (152-ФЗ compliance)

Revision ID: 002_add_passport_encryption
Revises: 001_add_deal_mvp_fields
Create Date: 2024-12-24 11:00:00.000000

Security: Passport data (series, number, issued_by) must be encrypted
to comply with Russian Federal Law 152-ФЗ on Personal Data.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_add_passport_encryption'
down_revision: Union[str, None] = '001_add_deal_mvp_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add encrypted passport fields to user_profiles
    # Note: Old plaintext fields are kept for backward compatibility
    # but marked as deprecated in the model

    # Check if table exists (it may be created by agent.housler.ru)
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if 'user_profiles' in inspector.get_table_names():
        # Add encrypted series
        op.add_column(
            'user_profiles',
            sa.Column('passport_series_encrypted', sa.Text, nullable=True)
        )

        # Add encrypted number
        op.add_column(
            'user_profiles',
            sa.Column('passport_number_encrypted', sa.Text, nullable=True)
        )

        # Add combined hash for duplicate detection
        op.add_column(
            'user_profiles',
            sa.Column('passport_hash', sa.String(64), nullable=True)
        )
        op.create_index(
            'ix_user_profiles_passport_hash',
            'user_profiles',
            ['passport_hash']
        )

        # Add encrypted issued_by
        op.add_column(
            'user_profiles',
            sa.Column('passport_issued_by_encrypted', sa.Text, nullable=True)
        )


def downgrade() -> None:
    connection = op.get_bind()
    inspector = sa.inspect(connection)

    if 'user_profiles' in inspector.get_table_names():
        op.drop_index('ix_user_profiles_passport_hash', table_name='user_profiles')
        op.drop_column('user_profiles', 'passport_issued_by_encrypted')
        op.drop_column('user_profiles', 'passport_hash')
        op.drop_column('user_profiles', 'passport_number_encrypted')
        op.drop_column('user_profiles', 'passport_series_encrypted')
