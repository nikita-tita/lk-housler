"""Add dispute lock mechanism fields (TASK-2.3)

Revision ID: 020_dispute_lock
Revises: 019_add_payment_profile
Create Date: 2026-01-19

TASK-2.3: Dispute Lock Mechanism
- Adds dispute_locked, dispute_locked_at, dispute_lock_reason to lk_deals
- Adds agency_deadline, platform_deadline, max_deadline to disputes
- Updates escalation_level default from 'none' to 'agency'

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '020_dispute_lock'
down_revision = '019_add_payment_profile'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add dispute lock fields to lk_deals
    op.add_column('lk_deals', sa.Column('dispute_locked', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('lk_deals', sa.Column('dispute_locked_at', sa.DateTime(), nullable=True))
    op.add_column('lk_deals', sa.Column('dispute_lock_reason', sa.String(500), nullable=True))

    # Add escalation deadline fields to disputes
    op.add_column('disputes', sa.Column('agency_deadline', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('platform_deadline', sa.DateTime(), nullable=True))
    op.add_column('disputes', sa.Column('max_deadline', sa.DateTime(), nullable=True))

    # Update default value for escalation_level from 'none' to 'agency'
    op.alter_column('disputes', 'escalation_level',
                    server_default='agency',
                    existing_type=sa.String(20),
                    existing_nullable=False)

    # Update existing disputes with escalation_level='none' to 'agency'
    op.execute("UPDATE disputes SET escalation_level = 'agency' WHERE escalation_level = 'none'")


def downgrade() -> None:
    # Remove escalation deadline fields from disputes
    op.drop_column('disputes', 'max_deadline')
    op.drop_column('disputes', 'platform_deadline')
    op.drop_column('disputes', 'agency_deadline')

    # Revert escalation_level default
    op.alter_column('disputes', 'escalation_level',
                    server_default='none',
                    existing_type=sa.String(20),
                    existing_nullable=False)

    # Remove dispute lock fields from lk_deals
    op.drop_column('lk_deals', 'dispute_lock_reason')
    op.drop_column('lk_deals', 'dispute_locked_at')
    op.drop_column('lk_deals', 'dispute_locked')
