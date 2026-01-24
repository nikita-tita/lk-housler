"""Add pending_employees table for employee invitations

Revision ID: 032_add_pending_employees
Revises: 031_add_client_name_encryption
Create Date: 2026-01-25

Employee invitation system for agencies
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '032_add_pending_employees'
down_revision = '031_add_client_name_encryption'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type and table via raw SQL to avoid SQLAlchemy auto-create issues
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employeeinvitestatus') THEN
                CREATE TYPE employeeinvitestatus AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
            END IF;
        END
        $$;

        CREATE TABLE IF NOT EXISTS pending_employees (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id),
            phone VARCHAR(20) NOT NULL,
            name VARCHAR(255),
            position VARCHAR(255),
            invite_token VARCHAR(64) NOT NULL UNIQUE,
            status employeeinvitestatus NOT NULL DEFAULT 'pending',
            expires_at TIMESTAMP NOT NULL,
            accepted_user_id INTEGER REFERENCES users(id),
            accepted_at TIMESTAMP,
            invited_by_user_id INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT now(),
            updated_at TIMESTAMP NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS ix_pending_employees_org_id ON pending_employees(org_id);
        CREATE INDEX IF NOT EXISTS ix_pending_employees_phone ON pending_employees(phone);
        CREATE INDEX IF NOT EXISTS ix_pending_employees_invite_token ON pending_employees(invite_token);
    """)


def downgrade() -> None:
    op.drop_table('pending_employees')
    op.execute("DROP TYPE employeeinvitestatus")
