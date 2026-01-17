"""Fix executor_id type from Integer to String

Revision ID: 013_fix_executor_id_type
Revises: 012_add_signed_contracts
Create Date: 2026-01-18 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "013_fix_executor_id_type"
down_revision = "012_add_signed_contracts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Change executor_id from Integer to String(36) to support both user IDs and organization UUIDs
    op.alter_column(
        "lk_deals",
        "executor_id",
        existing_type=sa.Integer(),
        type_=sa.String(36),
        existing_nullable=True,
        postgresql_using="executor_id::text"
    )


def downgrade() -> None:
    # Revert back to Integer (will lose UUID values)
    op.alter_column(
        "lk_deals",
        "executor_id",
        existing_type=sa.String(36),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="CASE WHEN executor_id ~ '^[0-9]+$' THEN executor_id::integer ELSE NULL END"
    )
