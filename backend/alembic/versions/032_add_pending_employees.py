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
    # Create enum type for employee invite status (if not exists)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employeeinvitestatus') THEN
                CREATE TYPE employeeinvitestatus AS ENUM ('pending', 'accepted', 'expired', 'cancelled');
            END IF;
        END
        $$;
    """)

    # Create pending_employees table
    op.create_table(
        'pending_employees',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('org_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('phone', sa.String(20), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('position', sa.String(255), nullable=True),
        sa.Column('invite_token', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('status', sa.Enum('pending', 'accepted', 'expired', 'cancelled', name='employeeinvitestatus'),
                  nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('accepted_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('accepted_at', sa.DateTime, nullable=True),
        sa.Column('invited_by_user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('pending_employees')
    op.execute("DROP TYPE employeeinvitestatus")
