"""Service completion models for deal confirmation"""

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


class ServiceCompletion(BaseModel):
    """Confirmation that service was completed satisfactorily"""

    __tablename__ = "service_completions"

    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    confirmed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Confirmation details
    confirmed_at = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)

    # Evidence files (list of EvidenceFile IDs)
    evidence_file_ids = Column(JSONB, nullable=True)

    # Client info at confirmation time
    client_ip = Column(String(45), nullable=True)
    client_user_agent = Column(Text, nullable=True)

    # Relationships
    deal = relationship("Deal", back_populates="service_completions")
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_user_id])
