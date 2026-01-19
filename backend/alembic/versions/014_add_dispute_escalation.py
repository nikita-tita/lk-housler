"""Добавление полей эскалации споров

Revision ID: 014_dispute_escalation
Revises: 013_fix_executor_id_type
Create Date: 2026-01-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '014_dispute_escalation'
down_revision = '013_fix_executor_id_type'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем поля эскалации в таблицу disputes
    op.add_column('disputes', sa.Column('escalation_level', sa.String(20), server_default='none', nullable=False))
    op.add_column('disputes', sa.Column('agency_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('disputes', sa.Column('escalated_at', sa.DateTime(), nullable=True))

    # Решение агентства (первый уровень)
    op.add_column('disputes', sa.Column('agency_decision', sa.String(50), nullable=True))
    op.add_column('disputes', sa.Column('agency_decision_notes', sa.Text(), nullable=True))
    op.add_column('disputes', sa.Column('agency_decision_by', sa.Integer(), nullable=True))
    op.add_column('disputes', sa.Column('agency_decision_at', sa.DateTime(), nullable=True))

    # Артефакты для суда
    op.add_column('disputes', sa.Column('court_artifacts_notes', sa.Text(), nullable=True))

    # Добавляем FK для agency_decision_by
    op.create_foreign_key(
        'fk_disputes_agency_decision_by',
        'disputes', 'users',
        ['agency_decision_by'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_disputes_agency_decision_by', 'disputes', type_='foreignkey')
    op.drop_column('disputes', 'court_artifacts_notes')
    op.drop_column('disputes', 'agency_decision_at')
    op.drop_column('disputes', 'agency_decision_by')
    op.drop_column('disputes', 'agency_decision_notes')
    op.drop_column('disputes', 'agency_decision')
    op.drop_column('disputes', 'escalated_at')
    op.drop_column('disputes', 'agency_id')
    op.drop_column('disputes', 'escalation_level')
