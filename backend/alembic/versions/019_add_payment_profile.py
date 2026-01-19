"""Add payment_profiles table for bank integration

Revision ID: 019_add_payment_profile
Revises: 018_merge_017_heads
Create Date: 2026-01-19

TASK-5.1: Payment Profile Model
- Stores legal info, bank details, and onboarding status
- For accepting payments via T-Bank Multiracchety
- Sensitive fields (INN, KPP, bank_account) are encrypted (152-FZ)

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '019_add_payment_profile'
down_revision = '018_merge_017_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'payment_profiles',
        # Primary key and timestamps (from BaseModel)
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),

        # Owner (one of these must be set)
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=True, index=True),

        # Legal info
        sa.Column('legal_type', sa.String(20), nullable=False),  # se, ip, ooo
        sa.Column('legal_name', sa.String(500), nullable=False),

        # Encrypted INN (152-FZ compliance)
        sa.Column('inn_encrypted', sa.Text(), nullable=False),
        sa.Column('inn_hash', sa.String(64), nullable=False, index=True),

        # Encrypted KPP (only for OOO)
        sa.Column('kpp_encrypted', sa.Text(), nullable=True),

        # OGRN (public data, not encrypted)
        sa.Column('ogrn', sa.String(15), nullable=True),

        # Bank details (encrypted account)
        sa.Column('bank_account_encrypted', sa.Text(), nullable=False),
        sa.Column('bank_bik', sa.String(9), nullable=False),
        sa.Column('bank_name', sa.String(255), nullable=False),
        sa.Column('bank_corr_account', sa.String(20), nullable=False),

        # Bank integration (T-Bank Multiracchety)
        sa.Column('bank_onboarding_status', sa.String(30), server_default='not_started', nullable=False, index=True),
        sa.Column('bank_merchant_id', sa.String(100), nullable=True),
        sa.Column('bank_onboarded_at', sa.DateTime(), nullable=True),

        # Fiscalization
        sa.Column('fiscalization_method', sa.String(30), server_default='not_required', nullable=False),
        sa.Column('tbank_checks_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('tbank_checks_merchant_id', sa.String(100), nullable=True),

        # KYC
        sa.Column('kyc_status', sa.String(30), server_default='not_started', nullable=False, index=True),
        sa.Column('kyc_submitted_at', sa.DateTime(), nullable=True),
        sa.Column('kyc_approved_at', sa.DateTime(), nullable=True),
        sa.Column('kyc_rejection_reason', sa.Text(), nullable=True),

        # Status
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False, index=True),
    )

    # Add check constraint: either user_id or organization_id must be set (but not both)
    op.create_check_constraint(
        'ck_payment_profiles_owner',
        'payment_profiles',
        '(user_id IS NOT NULL AND organization_id IS NULL) OR (user_id IS NULL AND organization_id IS NOT NULL)'
    )


def downgrade() -> None:
    op.drop_constraint('ck_payment_profiles_owner', 'payment_profiles', type_='check')
    op.drop_table('payment_profiles')
