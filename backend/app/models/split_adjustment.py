"""Split adjustment models for deal split modifications"""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    Text,
    DateTime,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class AdjustmentStatus(str, PyEnum):
    """Split adjustment status"""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class SplitAdjustment(BaseModel):
    """Request to adjust deal split percentages after deal creation"""

    __tablename__ = "split_adjustments"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Split changes
    old_split = Column(JSONB, nullable=False)  # {"user_123": 60, "user_456": 40}
    new_split = Column(JSONB, nullable=False)  # {"user_123": 50, "user_456": 50}

    # Request details
    reason = Column(Text, nullable=False)
    status = Column(String(20), default="pending", nullable=False)

    # Approval tracking
    required_approvers = Column(JSONB, nullable=False)  # [user_id1, user_id2]
    approvals = Column(JSONB, default=list)  # [{"user_id": 123, "approved_at": "..."}]
    rejections = Column(JSONB, default=list)  # [{"user_id": 456, "rejected_at": "...", "reason": "..."}]

    # Timestamps
    expires_at = Column(DateTime, nullable=True)  # Auto-expire if not approved
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="split_adjustments")
    requested_by = relationship("User", foreign_keys=[requested_by_user_id])
