"""Idempotency key model for bank API operations"""

from datetime import datetime, timedelta

from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.db.base import BaseModel


class IdempotencyKey(BaseModel):
    """Idempotency key for bank API operations.

    Ensures that duplicate requests (retries, network issues) don't result
    in duplicate operations in T-Bank.

    Usage:
        - create_deal: Prevent duplicate deal creation
        - confirm_release: Prevent duplicate fund releases
        - cancel: Prevent duplicate cancellations
    """

    __tablename__ = "idempotency_keys"

    # Unique key for the operation (UUID or hash)
    key = Column(String(255), unique=True, nullable=False, index=True)

    # Operation type
    operation = Column(String(50), nullable=False)  # create_deal, confirm_release, cancel

    # Associated deal
    deal_id = Column(UUID(as_uuid=True), ForeignKey("lk_deals.id"), nullable=False)

    # Hash of the request payload (for verification)
    request_hash = Column(String(64), nullable=False)

    # Cached response from the bank
    response_json = Column(JSONB, nullable=True)

    # Expiration (default: 24 hours)
    expires_at = Column(DateTime, nullable=False)

    # Relationships
    deal = relationship("Deal")

    # Composite index for efficient lookups
    __table_args__ = (
        Index("ix_idempotency_keys_deal_operation", "deal_id", "operation"),
    )

    @classmethod
    def create_key(
        cls,
        key: str,
        operation: str,
        deal_id,
        request_hash: str,
        ttl_hours: int = 24,
    ) -> "IdempotencyKey":
        """Factory method to create an idempotency key with default TTL."""
        return cls(
            key=key,
            operation=operation,
            deal_id=deal_id,
            request_hash=request_hash,
            expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
        )

    @property
    def is_expired(self) -> bool:
        """Check if the key has expired."""
        return datetime.utcnow() > self.expires_at
