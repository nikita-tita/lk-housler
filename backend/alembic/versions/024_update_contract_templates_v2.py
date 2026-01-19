"""Update contract templates to v2.0 for bank-led model

Revision ID: 024_update_contract_templates_v2
Revises: 023_merge_022_heads
Create Date: 2026-01-19

TASK-6.4: Contract Templates Update
Updates all contract templates to v2.0 with bank-led terminology:
- Removed legacy terminology
- Added T-Bank nominal account references
- Added hold period mechanism
- Added dispute/refund clauses

Note: This migration updates the version field and description for existing templates.
Old versions are preserved through the seed script versioning system.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '024_update_contract_templates_v2'
down_revision = '023_merge_022_heads'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update TPL-000 (User Agreement)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Terms of Service - соглашение между пользователем и платформой Housler. v2.0: Bank-led модель (T-Bank, hold period, споры)'
        WHERE code = 'TPL-000' AND version = '1.0'
    """)

    # Update TPL-001 (Buy)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Договор между агентом и клиентом-покупателем. v2.0: Оплата через T-Bank, hold period, возврат при споре'
        WHERE code = 'TPL-001' AND version = '1.0'
    """)

    # Update TPL-002 (Sell)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Договор между агентом и клиентом-продавцом. v2.0: Оплата через T-Bank, hold period, возврат при споре'
        WHERE code = 'TPL-002' AND version = '1.0'
    """)

    # Update TPL-003 (Rent)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Договор между агентом и клиентом по аренде. v2.0: Оплата через T-Bank, hold period, возврат при споре'
        WHERE code = 'TPL-003' AND version = '1.0'
    """)

    # Update TPL-004 (Exclusive)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Эксклюзивный договор на продажу объекта. v2.0: Оплата через T-Bank, hold period, возврат при споре'
        WHERE code = 'TPL-004' AND version = '1.0'
    """)

    # Update TPL-005 (Co-agent)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Соглашение между двумя агентами о разделе комиссии. v2.0: Автораспределение через T-Bank после hold period'
        WHERE code = 'TPL-005' AND version = '1.0'
    """)

    # Update TPL-006 (Agency-Agent)
    op.execute("""
        UPDATE contract_templates
        SET version = '2.0',
            description = 'Внутренний договор между агентством и агентом. v2.0: Автораспределение через T-Bank после hold period'
        WHERE code = 'TPL-006' AND version = '1.0'
    """)


def downgrade() -> None:
    # Revert TPL-000
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Terms of Service - соглашение между пользователем и платформой Housler'
        WHERE code = 'TPL-000' AND version = '2.0'
    """)

    # Revert TPL-001
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Договор между агентом и клиентом-покупателем'
        WHERE code = 'TPL-001' AND version = '2.0'
    """)

    # Revert TPL-002
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Договор между агентом и клиентом-продавцом'
        WHERE code = 'TPL-002' AND version = '2.0'
    """)

    # Revert TPL-003
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Договор между агентом и клиентом по аренде'
        WHERE code = 'TPL-003' AND version = '2.0'
    """)

    # Revert TPL-004
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Эксклюзивный договор на продажу объекта'
        WHERE code = 'TPL-004' AND version = '2.0'
    """)

    # Revert TPL-005
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Соглашение между двумя агентами о разделе комиссии'
        WHERE code = 'TPL-005' AND version = '2.0'
    """)

    # Revert TPL-006
    op.execute("""
        UPDATE contract_templates
        SET version = '1.0',
            description = 'Внутренний договор между агентством и агентом'
        WHERE code = 'TPL-006' AND version = '2.0'
    """)
