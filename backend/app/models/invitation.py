"""Deal invitation models for multi-agent deals"""

import secrets
from enum import Enum as PyEnum
from datetime import datetime, timedelta

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    Numeric,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class InvitationStatus(str, PyEnum):
    """Invitation status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class InvitationRole(str, PyEnum):
    """Role for invited party"""
    COAGENT = "coagent"  # Co-agent (splits commission)
    AGENCY = "agency"  # Agency receiving share


def generate_invitation_token() -> str:
    """Generate secure invitation token"""
    return secrets.token_urlsafe(32)


def default_expiry() -> datetime:
    """Default invitation expiry (7 days)"""
    return datetime.utcnow() + timedelta(days=7)


class DealInvitation(BaseModel):
    """Invitation for a partner to join a deal"""

    __tablename__ = "deal_invitations"

    # Deal and inviter
    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Invited party identification
    invited_phone = Column(String(20), nullable=False, index=True)  # Primary identifier
    invited_email = Column(String(255), nullable=True)
    invited_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Set when accepted by existing user

    # Role and split
    role = Column(String(50), nullable=False)  # coagent/agency
    split_percent = Column(Numeric(5, 2), nullable=False)  # 0-100

    # Invitation token
    token = Column(String(64), unique=True, nullable=False, index=True, default=generate_invitation_token)

    # Status tracking
    status = Column(String(20), default="pending", nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, default=default_expiry)

    # Response tracking
    responded_at = Column(DateTime, nullable=True)
    decline_reason = Column(Text, nullable=True)

    # SMS/Email delivery tracking
    last_sent_at = Column(DateTime, nullable=True)
    send_count = Column(Integer, default=0, nullable=False)

    # Relationships
    deal = relationship("Deal", back_populates="invitations")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    invited_user = relationship("User", foreign_keys=[invited_user_id])

    @property
    def is_expired(self) -> bool:
        """Check if invitation is expired"""
        return datetime.utcnow() > self.expires_at

    @property
    def can_respond(self) -> bool:
        """Check if invitation can still be responded to"""
        return self.status == "pending" and not self.is_expired

    def accept(self, user_id: int) -> None:
        """Accept the invitation"""
        self.status = InvitationStatus.ACCEPTED.value
        self.invited_user_id = user_id
        self.responded_at = datetime.utcnow()

    def decline(self, reason: str = None) -> None:
        """Decline the invitation"""
        self.status = InvitationStatus.DECLINED.value
        self.decline_reason = reason
        self.responded_at = datetime.utcnow()

    def cancel(self) -> None:
        """Cancel the invitation (by inviter)"""
        self.status = InvitationStatus.CANCELLED.value
