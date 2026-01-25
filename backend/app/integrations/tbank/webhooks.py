"""T-Bank webhook handler"""

import hashlib
import hmac
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    """T-Bank webhook event types"""
    # Payment events
    PAYMENT_AUTHORIZED = "payment.authorized"
    PAYMENT_CONFIRMED = "payment.confirmed"
    PAYMENT_REJECTED = "payment.rejected"
    PAYMENT_REFUNDED = "payment.refunded"

    # Deal events
    DEAL_CREATED = "deal.created"
    DEAL_PAID = "deal.paid"
    DEAL_HOLD_STARTED = "deal.hold_started"
    DEAL_RELEASED = "deal.released"
    DEAL_CANCELLED = "deal.cancelled"
    DEAL_REFUNDED = "deal.refunded"

    # Split events
    SPLIT_COMPLETED = "split.completed"
    SPLIT_FAILED = "split.failed"


@dataclass
class WebhookEvent:
    """Parsed webhook event"""
    event_id: str
    event_type: WebhookEventType
    deal_id: Optional[str]
    payment_id: Optional[str]
    amount: Optional[int]  # kopecks
    status: Optional[str]
    error_code: Optional[str]
    error_message: Optional[str]
    timestamp: datetime
    raw_payload: dict


class TBankWebhookHandler:
    """
    Handler for T-Bank webhooks.

    Validates signature and parses webhook payload.
    """

    def __init__(self, secret_key: str = None):
        self.secret_key = secret_key or settings.TBANK_WEBHOOK_SECRET

    def _generate_signature(self, payload: dict) -> str:
        """Generate expected signature for payload"""
        # Sort keys and concatenate values (excluding Token)
        sorted_values = []
        for key in sorted(payload.keys()):
            if key not in ("Token", "Signature") and payload[key] is not None:
                sorted_values.append(str(payload[key]))

        # Add secret key
        sorted_values.append(self.secret_key)

        # SHA-256 hash
        concat = "".join(sorted_values)
        return hashlib.sha256(concat.encode("utf-8")).hexdigest()

    def verify_signature(self, payload: dict, signature: str = None) -> bool:
        """
        Verify webhook signature.

        Args:
            payload: Webhook payload dict
            signature: Signature from header (or from payload['Token'])

        Returns:
            True if signature is valid
        """
        if not self.secret_key:
            logger.error("Webhook secret not configured - rejecting webhook (fail-closed)")
            return False

        # Get signature from payload if not provided
        provided_signature = signature or payload.get("Token") or payload.get("Signature")
        if not provided_signature:
            logger.error("No signature provided in webhook")
            return False

        expected = self._generate_signature(payload)
        is_valid = hmac.compare_digest(expected.lower(), provided_signature.lower())

        if not is_valid:
            logger.warning(f"Invalid webhook signature. Expected: {expected[:10]}..., Got: {provided_signature[:10]}...")

        return is_valid

    def parse_event(self, payload: dict) -> WebhookEvent:
        """
        Parse webhook payload into WebhookEvent.

        Args:
            payload: Raw webhook payload

        Returns:
            WebhookEvent object
        """
        # Determine event type from payload
        event_type_str = payload.get("EventType") or payload.get("Status") or "unknown"

        # Map T-Bank status to our event type
        event_type = self._map_event_type(event_type_str, payload)

        # Parse timestamp
        timestamp_str = payload.get("DateTime") or payload.get("Timestamp")
        if timestamp_str:
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            except ValueError:
                timestamp = datetime.utcnow()
        else:
            timestamp = datetime.utcnow()

        return WebhookEvent(
            event_id=payload.get("EventId") or payload.get("PaymentId") or "",
            event_type=event_type,
            deal_id=payload.get("DealId") or payload.get("OrderId"),
            payment_id=payload.get("PaymentId"),
            amount=payload.get("Amount"),
            status=payload.get("Status"),
            error_code=payload.get("ErrorCode"),
            error_message=payload.get("ErrorMessage") or payload.get("Message"),
            timestamp=timestamp,
            raw_payload=payload,
        )

    def _map_event_type(self, status: str, payload: dict) -> WebhookEventType:
        """Map T-Bank status/event to our WebhookEventType"""
        status_lower = status.lower()

        # Direct event type mapping
        try:
            return WebhookEventType(status_lower)
        except ValueError:
            pass

        # Status-based mapping
        status_map = {
            "authorized": WebhookEventType.PAYMENT_AUTHORIZED,
            "confirmed": WebhookEventType.PAYMENT_CONFIRMED,
            "rejected": WebhookEventType.PAYMENT_REJECTED,
            "refunded": WebhookEventType.PAYMENT_REFUNDED,
            "paid": WebhookEventType.DEAL_PAID,
            "hold": WebhookEventType.DEAL_HOLD_STARTED,
            "released": WebhookEventType.DEAL_RELEASED,
            "cancelled": WebhookEventType.DEAL_CANCELLED,
        }

        if status_lower in status_map:
            return status_map[status_lower]

        # Default based on payload structure
        if "DealId" in payload:
            return WebhookEventType.DEAL_PAID
        return WebhookEventType.PAYMENT_CONFIRMED

    def handle_event(self, event: WebhookEvent) -> dict:
        """
        Process webhook event and return response.

        This is a template method - actual handling should be done
        by the service layer.

        Args:
            event: Parsed WebhookEvent

        Returns:
            Response dict for T-Bank (usually {"Success": True})
        """
        logger.info(f"Handling webhook event: {event.event_type} for deal {event.deal_id}")

        # Return success response for T-Bank
        return {"Success": True}
