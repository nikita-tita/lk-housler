"""Update consent types for B2B bank-led model

Revision ID: 026_update_consent_types
Revises: 025_add_fiscal_receipts
Create Date: 2026-01-19

TASK-4.2: Consent Flow Update for B2B Structure

This migration documents the consent type changes for the bank-led payment model:

RENAMED:
- platform_commission -> platform_fee_deduction (old value kept for backwards compat)

NEW CONSENT TYPES:
- platform_fee_deduction: Agree to platform fee deduction from T-Bank nominal account
- bank_payment_processing: Consent for T-Bank nominal account (Multiracchety) processing
- service_confirmation_required: Agree that service must be confirmed before payout
- hold_period_acceptance: Accept hold period before payout

TERMINOLOGY CHANGES:
- "escrow" -> "nominal account T-Bank" (nominalnyy schyot)
- "automatic payout after 1 hour" -> "payout after service confirmation"
- No MoR (Merchant of Record) terminology

Note: This migration is a no-op for database structure since consent_type is VARCHAR(50).
The changes are in application code (ConsentType enum and CONSENT_TEXTS dictionary).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '026_update_consent_types'
down_revision: Union[str, None] = '025_add_fiscal_receipts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    No database changes required.

    Consent types are stored as VARCHAR(50) which accepts any string value.
    The new consent types are:
    - platform_fee_deduction
    - bank_payment_processing
    - service_confirmation_required
    - hold_period_acceptance

    These are defined in app/models/consent.py ConsentType enum.
    """
    # Add comment to deal_consents table documenting the consent types
    op.execute("""
        COMMENT ON TABLE deal_consents IS
        'User consent records for deals. Consent types (v2.0 B2B model):
        - platform_fee_deduction: Agree to platform fee deduction
        - data_processing: Personal data processing (152-FZ)
        - terms_of_service: Platform terms
        - split_agreement: Split distribution agreement
        - bank_payment_processing: T-Bank nominal account processing
        - service_confirmation_required: Service confirmation before payout
        - hold_period_acceptance: Hold period acceptance
        - platform_commission: DEPRECATED, use platform_fee_deduction';
    """)

    op.execute("""
        COMMENT ON COLUMN deal_consents.consent_type IS
        'Type of consent: platform_fee_deduction, data_processing, terms_of_service,
        split_agreement, bank_payment_processing, service_confirmation_required,
        hold_period_acceptance. Legacy: platform_commission (deprecated)';
    """)


def downgrade() -> None:
    """Remove comments (optional, comments don't affect functionality)"""
    op.execute("COMMENT ON TABLE deal_consents IS NULL;")
    op.execute("COMMENT ON COLUMN deal_consents.consent_type IS NULL;")
