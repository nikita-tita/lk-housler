"""Добавление полей оплаты и аванса в сделки

Revision ID: 015_deal_payment_fields
Revises: 014_dispute_escalation
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015_deal_payment_fields'
down_revision = '014_dispute_escalation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Тип объекта недвижимости
    op.add_column('lk_deals', sa.Column('property_type', sa.String(30), nullable=True))

    # Условия оплаты
    op.add_column('lk_deals', sa.Column('payment_type', sa.String(20), server_default='percent', nullable=False))
    op.add_column('lk_deals', sa.Column('commission_percent', sa.Numeric(5, 2), nullable=True))
    op.add_column('lk_deals', sa.Column('commission_fixed', sa.Numeric(15, 2), nullable=True))

    # Аванс
    op.add_column('lk_deals', sa.Column('advance_type', sa.String(20), server_default='none', nullable=False))
    op.add_column('lk_deals', sa.Column('advance_amount', sa.Numeric(15, 2), nullable=True))
    op.add_column('lk_deals', sa.Column('advance_percent', sa.Numeric(5, 2), nullable=True))
    op.add_column('lk_deals', sa.Column('advance_paid', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('lk_deals', sa.Column('advance_paid_at', sa.DateTime(), nullable=True))

    # Эксклюзив
    op.add_column('lk_deals', sa.Column('is_exclusive', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('lk_deals', sa.Column('exclusive_until', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('lk_deals', 'exclusive_until')
    op.drop_column('lk_deals', 'is_exclusive')
    op.drop_column('lk_deals', 'advance_paid_at')
    op.drop_column('lk_deals', 'advance_paid')
    op.drop_column('lk_deals', 'advance_percent')
    op.drop_column('lk_deals', 'advance_amount')
    op.drop_column('lk_deals', 'advance_type')
    op.drop_column('lk_deals', 'commission_fixed')
    op.drop_column('lk_deals', 'commission_percent')
    op.drop_column('lk_deals', 'payment_type')
    op.drop_column('lk_deals', 'property_type')
