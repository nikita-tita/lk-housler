"""Add NPD receipt tracking fields to fiscal_receipts table

Revision ID: 027_add_npd_receipt_fields
Revises: 026_update_consent_types
Create Date: 2026-01-19

TASK-3.3: NPD Receipt Tracking

This migration adds fields for tracking NPD (Nalog na Professionalnyj Dohod)
receipts from self-employed persons.

New fields:
- recipient_id: User who should create the receipt (FK to users)
- fiscalization_method: Method used (npd_receipt, tbank_checks, etc.)
- npd_receipt_number: Receipt number from "Moy Nalog" app
- npd_source: How receipt was uploaded (my_nalog_app, manual, etc.)
- npd_uploaded_at: When user uploaded receipt data
- reminder_count: Number of reminders sent
- first_reminder_at: When first reminder was sent
- last_reminder_at: When last reminder was sent
- next_reminder_at: When next reminder should be sent
- escalated_at: When escalated to admin
- receipt_deadline: Deadline for receipt upload

Reminder Schedule:
- First reminder: 24 hours after release
- Second reminder: 72 hours after release
- Escalation to admin: 7 days after release (overdue)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '027_add_npd_receipt_fields'
down_revision: Union[str, None] = '026_update_consent_types'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add recipient_id column (FK to users)
    op.add_column(
        'fiscal_receipts',
        sa.Column('recipient_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True)
    )
    op.create_index('ix_fiscal_receipts_recipient_id', 'fiscal_receipts', ['recipient_id'])

    # Add fiscalization method
    op.add_column(
        'fiscal_receipts',
        sa.Column('fiscalization_method', sa.String(30), nullable=True)
    )

    # Add NPD-specific fields
    op.add_column(
        'fiscal_receipts',
        sa.Column('npd_receipt_number', sa.String(50), nullable=True)
    )
    op.create_index('ix_fiscal_receipts_npd_receipt_number', 'fiscal_receipts', ['npd_receipt_number'])

    op.add_column(
        'fiscal_receipts',
        sa.Column('npd_source', sa.String(30), nullable=True)
    )

    op.add_column(
        'fiscal_receipts',
        sa.Column('npd_uploaded_at', sa.DateTime(timezone=True), nullable=True)
    )

    # Add reminder tracking fields
    op.add_column(
        'fiscal_receipts',
        sa.Column('reminder_count', sa.Integer, nullable=False, server_default='0')
    )

    op.add_column(
        'fiscal_receipts',
        sa.Column('first_reminder_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.add_column(
        'fiscal_receipts',
        sa.Column('last_reminder_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.add_column(
        'fiscal_receipts',
        sa.Column('next_reminder_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index('ix_fiscal_receipts_next_reminder_at', 'fiscal_receipts', ['next_reminder_at'])

    op.add_column(
        'fiscal_receipts',
        sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True)
    )

    # Add receipt deadline
    op.add_column(
        'fiscal_receipts',
        sa.Column('receipt_deadline', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index('ix_fiscal_receipts_receipt_deadline', 'fiscal_receipts', ['receipt_deadline'])

    # Create composite index for finding receipts due for reminder
    op.create_index(
        'ix_fiscal_receipts_reminder_due',
        'fiscal_receipts',
        ['fiscalization_method', 'status', 'next_reminder_at'],
        postgresql_where=sa.text("fiscalization_method = 'npd_receipt' AND status = 'awaiting_upload'")
    )


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_fiscal_receipts_reminder_due', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_receipt_deadline', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_next_reminder_at', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_npd_receipt_number', table_name='fiscal_receipts')
    op.drop_index('ix_fiscal_receipts_recipient_id', table_name='fiscal_receipts')

    # Drop columns
    op.drop_column('fiscal_receipts', 'receipt_deadline')
    op.drop_column('fiscal_receipts', 'escalated_at')
    op.drop_column('fiscal_receipts', 'next_reminder_at')
    op.drop_column('fiscal_receipts', 'last_reminder_at')
    op.drop_column('fiscal_receipts', 'first_reminder_at')
    op.drop_column('fiscal_receipts', 'reminder_count')
    op.drop_column('fiscal_receipts', 'npd_uploaded_at')
    op.drop_column('fiscal_receipts', 'npd_source')
    op.drop_column('fiscal_receipts', 'npd_receipt_number')
    op.drop_column('fiscal_receipts', 'fiscalization_method')
    op.drop_column('fiscal_receipts', 'recipient_id')
