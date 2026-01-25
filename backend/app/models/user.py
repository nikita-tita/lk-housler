"""User models - mapped to agent.housler.ru database schema"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, Enum
from sqlalchemy.orm import relationship

from app.db.base import Base

# Note: User table exists in agent.housler.ru with Integer IDs
# We map to existing schema, NOT create new tables


class UserRole(str, PyEnum):
    """User role in Housler ecosystem (matches DB enum 'user_role')"""

    CLIENT = "client"
    AGENT = "agent"
    AGENCY_ADMIN = "agency_admin"
    OPERATOR = "operator"
    ADMIN = "admin"


class User(Base):
    """
    User account - maps to existing agent.housler.ru users table.

    IMPORTANT: This model does NOT create a new table.
    It maps to the existing 'users' table in housler_agent database.
    ID is INTEGER (not UUID like other lk.housler.ru models).
    """

    __tablename__ = "users"

    # Primary key - INTEGER (not UUID!)
    id = Column(Integer, primary_key=True, index=True)

    # Core fields (from agent.housler.ru schema)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True, index=True)
    name = Column(String(255), nullable=True)

    # Role (uses existing DB enum 'user_role')
    # Note: values_callable ensures SQLAlchemy uses enum values (lowercase) not names (uppercase)
    role = Column(
        Enum(UserRole, name='user_role', create_type=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=UserRole.CLIENT
    )

    # Status - agent.housler.ru uses is_active boolean, NOT status enum
    is_active = Column(Boolean, default=True, nullable=True)

    # Agency link
    agency_id = Column(Integer, nullable=True)

    # Timestamps
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=True)

    # Additional fields from agent.housler.ru
    phone_verified = Column(Boolean, default=False, nullable=True)
    city = Column(String(100), nullable=True)
    is_self_employed = Column(Boolean, default=False, nullable=True)
    personal_inn = Column(String(12), nullable=True)
    password_hash = Column(String(255), nullable=True)
    registration_status = Column(String(20), default="active", nullable=True)

    # Encrypted fields (152-FZ compliance)
    email_hash = Column(String(64), nullable=True)
    phone_hash = Column(String(64), nullable=True)
    name_encrypted = Column(Text, nullable=True)
    phone_encrypted = Column(Text, nullable=True)
    email_encrypted = Column(Text, nullable=True)
    personal_inn_encrypted = Column(Text, nullable=True)
    personal_inn_hash = Column(String(64), nullable=True)

    # Contact preferences
    preferred_contact = Column(String(20), default="phone", nullable=True)
    telegram_username = Column(String(100), nullable=True)
    whatsapp_phone = Column(String(20), nullable=True)

    # Agent profile fields
    avatar_url = Column(String(500), nullable=True)
    experience_years = Column(Integer, nullable=True)
    about = Column(Text, nullable=True)
    legal_data_filled = Column(Boolean, default=False, nullable=True)

    # Relationships to lk.housler.ru tables (using Integer FK)
    deals_created = relationship("Deal", foreign_keys="Deal.created_by_user_id", back_populates="creator")
    deals_as_agent = relationship("Deal", foreign_keys="Deal.agent_user_id", back_populates="agent")
    organizations = relationship("OrganizationMember", back_populates="user")

    @property
    def is_admin(self) -> bool:
        """Check if user has admin privileges"""
        return self.role in ("admin", "operator")

    @property
    def display_name(self) -> str:
        """Get display name for UI"""
        return self.name or self.email or self.phone or f"User {self.id}"


# Note: UserProfile, UserConsent, OTPSession tables do NOT exist in agent.housler.ru
# They were designed for lk.housler.ru but never migrated
# Remove these models - they are not used

# If needed in future, create separate migration for lk-specific tables
