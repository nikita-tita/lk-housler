"""Webhook handler service for T-Bank webhooks.

Provides:
- Signature validation (HMAC-SHA256)
- Idempotent processing
- Dead Letter Queue for failed webhooks
"""

import hashlib
import hmac
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.bank_split import BankEvent
from app.models.webhook_dlq import WebhookDLQ

logger = logging.getLogger(__name__)


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """
    Verify T-Bank webhook signature using HMAC-SHA256.

    Args:
        payload: Raw request body bytes
        signature: Signature from X-TBank-Signature header
        secret: Webhook secret key

    Returns:
        True if signature is valid
    """
    if not secret:
        logger.error("TBANK_WEBHOOK_SECRET not configured - rejecting webhook (fail-closed)")
        return False

    if not signature:
        logger.warning("No signature provided in webhook request")
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256
    ).hexdigest()

    is_valid = hmac.compare_digest(expected.lower(), signature.lower())

    if not is_valid:
        logger.warning(
            f"Invalid webhook signature. Expected: {expected[:16]}..., Got: {signature[:16]}..."
        )

    return is_valid


class WebhookService:
    """Service for processing T-Bank webhooks with idempotency and DLQ support."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_idempotency(self, idempotency_key: str) -> Optional[BankEvent]:
        """
        Check if webhook has already been processed.

        Args:
            idempotency_key: Unique key for the webhook event

        Returns:
            Existing BankEvent if already processed, None otherwise
        """
        if not idempotency_key:
            return None

        result = await self.db.execute(
            select(BankEvent).where(
                BankEvent.idempotency_key == idempotency_key,
                BankEvent.processed_at.isnot(None)
            )
        )
        return result.scalar_one_or_none()

    async def mark_processed(self, event: BankEvent) -> None:
        """
        Mark webhook event as successfully processed.

        Args:
            event: BankEvent to mark as processed
        """
        event.processed_at = datetime.utcnow()
        event.status = "processed"

    async def save_to_dlq(
        self,
        event_type: str,
        payload: dict,
        error_message: str,
        deal_id: Optional[UUID] = None,
    ) -> WebhookDLQ:
        """
        Save failed webhook to Dead Letter Queue.

        Args:
            event_type: Type of webhook event
            payload: Original webhook payload
            error_message: Error description
            deal_id: Associated deal ID if known

        Returns:
            Created WebhookDLQ entry
        """
        dlq_entry = WebhookDLQ(
            event_type=event_type,
            payload=payload,
            error_message=error_message,
            deal_id=deal_id,
            retry_count=0,
        )

        self.db.add(dlq_entry)
        await self.db.flush()

        logger.error(
            f"Webhook saved to DLQ: {event_type}, error: {error_message}, dlq_id: {dlq_entry.id}"
        )

        return dlq_entry

    async def get_dlq_entries(
        self,
        resolved: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WebhookDLQ], int]:
        """
        Get Dead Letter Queue entries.

        Args:
            resolved: If True, include resolved entries; if False, only unresolved
            limit: Maximum number of entries to return
            offset: Offset for pagination

        Returns:
            Tuple of (entries list, total count)
        """
        from sqlalchemy import func

        # Base query
        query = select(WebhookDLQ)

        if resolved:
            query = query.where(WebhookDLQ.resolved_at.isnot(None))
        else:
            query = query.where(WebhookDLQ.resolved_at.is_(None))

        # Count total
        count_query = select(func.count(WebhookDLQ.id))
        if resolved:
            count_query = count_query.where(WebhookDLQ.resolved_at.isnot(None))
        else:
            count_query = count_query.where(WebhookDLQ.resolved_at.is_(None))

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Get entries
        query = query.order_by(WebhookDLQ.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        entries = list(result.scalars().all())

        return entries, total

    async def retry_dlq_entry(self, dlq_id: UUID) -> WebhookDLQ:
        """
        Mark DLQ entry for retry (increment retry_count).

        Args:
            dlq_id: ID of DLQ entry to retry

        Returns:
            Updated WebhookDLQ entry

        Raises:
            ValueError: If entry not found or already resolved
        """
        result = await self.db.execute(
            select(WebhookDLQ).where(WebhookDLQ.id == dlq_id)
        )
        entry = result.scalar_one_or_none()

        if not entry:
            raise ValueError(f"DLQ entry not found: {dlq_id}")

        if entry.resolved_at:
            raise ValueError(f"DLQ entry already resolved: {dlq_id}")

        entry.retry_count += 1
        entry.last_retry_at = datetime.utcnow()

        return entry

    async def resolve_dlq_entry(
        self,
        dlq_id: UUID,
        resolution_notes: Optional[str] = None,
    ) -> WebhookDLQ:
        """
        Mark DLQ entry as resolved.

        Args:
            dlq_id: ID of DLQ entry to resolve
            resolution_notes: Optional notes about resolution

        Returns:
            Updated WebhookDLQ entry

        Raises:
            ValueError: If entry not found or already resolved
        """
        result = await self.db.execute(
            select(WebhookDLQ).where(WebhookDLQ.id == dlq_id)
        )
        entry = result.scalar_one_or_none()

        if not entry:
            raise ValueError(f"DLQ entry not found: {dlq_id}")

        if entry.resolved_at:
            raise ValueError(f"DLQ entry already resolved: {dlq_id}")

        entry.resolved_at = datetime.utcnow()
        if resolution_notes:
            entry.error_message = f"{entry.error_message}\n\nResolution: {resolution_notes}"

        return entry

    async def get_dlq_entry(self, dlq_id: UUID) -> Optional[WebhookDLQ]:
        """
        Get a single DLQ entry by ID.

        Args:
            dlq_id: ID of DLQ entry

        Returns:
            WebhookDLQ entry or None
        """
        result = await self.db.execute(
            select(WebhookDLQ).where(WebhookDLQ.id == dlq_id)
        )
        return result.scalar_one_or_none()
