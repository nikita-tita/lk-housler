"""Add act signing fields for client confirmation (UC-3.2)

Revision ID: 033_add_act_signing_fields
Revises: 032_add_pending_employees
Create Date: 2026-01-25

UC-3.2: Client confirmation through Act signing

This migration adds fields to lk_deals table for tracking the client
confirmation workflow where clients sign an Act of Completed Services
(Акт выполненных работ) via PEP (Simple Electronic Signature).

New workflow:
1. Agent marks service completed → AWAITING_CLIENT_CONFIRMATION
2. Act document generated
3. Client receives SMS/email with signing link
4. Client signs Act via PEP (SMS OTP)
5. Deal moves to PAYOUT_READY → release

Fields added:
- act_document_id: FK to the generated Act document
- client_confirmation_requested_at: When agent marked service completed
- client_confirmation_deadline: +7 days auto-release deadline
- act_signed_at: When client signed the Act
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '033_add_act_signing_fields'
down_revision: Union[str, None] = '032_add_pending_employees'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add act signing fields to lk_deals
    op.add_column('lk_deals', sa.Column('act_document_id', UUID(as_uuid=True), nullable=True))
    op.add_column('lk_deals', sa.Column('client_confirmation_requested_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lk_deals', sa.Column('client_confirmation_deadline', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lk_deals', sa.Column('act_signed_at', sa.DateTime(timezone=True), nullable=True))

    # Add foreign key constraint for act_document_id
    op.create_foreign_key(
        'fk_lk_deals_act_document_id',
        'lk_deals',
        'documents',
        ['act_document_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for deadline queries (used by Celery task to find expired confirmations)
    op.create_index(
        'ix_lk_deals_client_confirmation_deadline',
        'lk_deals',
        ['client_confirmation_deadline'],
        postgresql_where=sa.text("client_confirmation_deadline IS NOT NULL AND act_signed_at IS NULL")
    )


def downgrade() -> None:
    op.drop_index('ix_lk_deals_client_confirmation_deadline', 'lk_deals')
    op.drop_constraint('fk_lk_deals_act_document_id', 'lk_deals', type_='foreignkey')
    op.drop_column('lk_deals', 'act_signed_at')
    op.drop_column('lk_deals', 'client_confirmation_deadline')
    op.drop_column('lk_deals', 'client_confirmation_requested_at')
    op.drop_column('lk_deals', 'act_document_id')
