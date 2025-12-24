"""Add signing_tokens table for public document signing

Revision ID: 003_add_signing_tokens
Revises: 002_add_passport_encryption
Create Date: 2024-12-24 12:00:00.000000

This table stores tokens that allow clients to sign documents
without authentication via a unique URL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '003_add_signing_tokens'
down_revision: Union[str, None] = '002_add_passport_encryption'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'signing_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('token', sa.String(32), nullable=False, unique=True, index=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('party_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('deal_parties.id'), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('used', sa.Boolean, default=False, nullable=False),
        sa.Column('used_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('signing_tokens')
