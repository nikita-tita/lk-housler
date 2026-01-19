"""Webhook Dead Letter Queue model.

Stores failed webhook events for later retry or manual resolution.
"""

from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class WebhookDLQ(BaseModel):
    """Dead Letter Queue for failed webhook events.

    When webhook processing fails (e.g., invalid payload, processing error),
    the event is stored here for:
    - Manual review by admins
    - Automated retry
    - Debugging and monitoring
    """

    __tablename__ = "webhook_dlq"

    # Event identification
    event_type = Column(String(100), nullable=False, index=True)

    # Original payload (preserved for debugging and retry)
    payload = Column(JSONB, nullable=False)

    # Error details
    error_message = Column(Text, nullable=False)

    # Retry tracking
    retry_count = Column(Integer, default=0, nullable=False)
    last_retry_at = Column(DateTime, nullable=True)

    # Resolution
    resolved_at = Column(DateTime, nullable=True, index=True)

    # Optional link to deal (if identifiable from payload)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=True, index=True)

    # Relationships
    deal = relationship("Deal", foreign_keys=[deal_id])
