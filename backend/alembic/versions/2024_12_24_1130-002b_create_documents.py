"""Create documents, signatures, contract_templates tables

Revision ID: 002b_create_documents
Revises: 002_add_passport_encryption
Create Date: 2024-12-24 11:30:00.000000

Creates the document-related tables for contract generation and signing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '002b_create_documents'
down_revision: Union[str, None] = '002_add_passport_encryption'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create contract_templates table
    op.create_table(
        'contract_templates',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('version', sa.String(20), nullable=False),
        sa.Column('placeholders_schema', JSONB, nullable=False),
        sa.Column('template_body', sa.Text, nullable=False),
        sa.Column('active', sa.Boolean, default=True, nullable=False),
    )

    # Create documents table
    op.create_table(
        'documents',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('deal_id', UUID(as_uuid=True), sa.ForeignKey('deals.id'), nullable=False),
        sa.Column('template_id', UUID(as_uuid=True), sa.ForeignKey('contract_templates.id'), nullable=True),
        sa.Column('version_no', sa.Integer, default=1, nullable=False),
        sa.Column('status', sa.String(20), default='generated', nullable=False, index=True),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('document_hash', sa.String(64), nullable=False, index=True),
    )
    op.create_index('ix_documents_deal_id', 'documents', ['deal_id'])

    # Create signatures table
    op.create_table(
        'signatures',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'), nullable=False),
        sa.Column('document_id', UUID(as_uuid=True), sa.ForeignKey('documents.id'), nullable=False),
        sa.Column('signer_party_id', UUID(as_uuid=True), sa.ForeignKey('deal_parties.id'), nullable=False),
        sa.Column('method', sa.String(20), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('otp_request_id', UUID(as_uuid=True), nullable=True),
        sa.Column('signed_at', sa.DateTime, nullable=True),
        sa.Column('evidence', JSONB, nullable=True),
    )
    op.create_index('ix_signatures_document_id', 'signatures', ['document_id'])


def downgrade() -> None:
    op.drop_table('signatures')
    op.drop_table('documents')
    op.drop_table('contract_templates')
