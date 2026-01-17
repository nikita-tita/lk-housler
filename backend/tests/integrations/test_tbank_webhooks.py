"""Tests for TBank webhook handler"""

import pytest
from datetime import datetime

from app.integrations.tbank.webhooks import (
    TBankWebhookHandler,
    WebhookEventType,
)


@pytest.fixture
def webhook_handler():
    """Create webhook handler with test secret"""
    return TBankWebhookHandler(secret_key="test_secret_key")


class TestTBankWebhookHandler:
    """Tests for TBankWebhookHandler"""

    def test_parse_payment_confirmed_event(self, webhook_handler):
        """Test parsing payment confirmed webhook"""
        payload = {
            "EventId": "evt_123",
            "EventType": "payment.confirmed",
            "DealId": "deal_abc",
            "PaymentId": "pay_xyz",
            "Amount": 10000000,  # 100,000 rubles in kopecks
            "Status": "CONFIRMED",
            "DateTime": "2026-01-16T12:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_id == "evt_123"
        assert event.event_type == WebhookEventType.PAYMENT_CONFIRMED
        assert event.deal_id == "deal_abc"
        assert event.payment_id == "pay_xyz"
        assert event.amount == 10000000
        assert event.status == "CONFIRMED"

    def test_parse_deal_paid_event(self, webhook_handler):
        """Test parsing deal paid webhook"""
        payload = {
            "EventType": "deal.paid",
            "DealId": "deal_123",
            "Amount": 50000000,
            "Status": "PAID",
            "DateTime": "2026-01-16T14:30:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.DEAL_PAID
        assert event.deal_id == "deal_123"

    def test_parse_deal_released_event(self, webhook_handler):
        """Test parsing deal released webhook"""
        payload = {
            "EventType": "deal.released",
            "DealId": "deal_456",
            "DateTime": "2026-01-16T15:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.DEAL_RELEASED

    def test_parse_deal_cancelled_event(self, webhook_handler):
        """Test parsing deal cancelled webhook"""
        payload = {
            "EventType": "deal.cancelled",
            "DealId": "deal_789",
            "ErrorCode": "USER_CANCELLED",
            "ErrorMessage": "Cancelled by user",
            "DateTime": "2026-01-16T16:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.DEAL_CANCELLED
        assert event.error_code == "USER_CANCELLED"
        assert event.error_message == "Cancelled by user"

    def test_parse_status_based_mapping(self, webhook_handler):
        """Test status-based event type mapping"""
        # When EventType is missing, map from Status
        payload = {
            "DealId": "deal_123",
            "Status": "PAID",
            "DateTime": "2026-01-16T12:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.DEAL_PAID

    def test_parse_hold_status(self, webhook_handler):
        """Test hold status mapping"""
        payload = {
            "DealId": "deal_123",
            "Status": "HOLD",
            "DateTime": "2026-01-16T12:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.DEAL_HOLD_STARTED

    def test_parse_datetime_with_timezone(self, webhook_handler):
        """Test parsing datetime with Z timezone"""
        payload = {
            "EventType": "deal.paid",
            "DealId": "deal_123",
            "DateTime": "2026-01-16T12:30:45Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.timestamp.year == 2026
        assert event.timestamp.month == 1
        assert event.timestamp.day == 16
        assert event.timestamp.hour == 12
        assert event.timestamp.minute == 30

    def test_parse_datetime_missing(self, webhook_handler):
        """Test parsing when datetime is missing"""
        payload = {
            "EventType": "deal.paid",
            "DealId": "deal_123",
        }

        event = webhook_handler.parse_event(payload)

        # Should use current time
        assert event.timestamp is not None
        assert isinstance(event.timestamp, datetime)

    def test_handle_event_returns_success(self, webhook_handler):
        """Test handle_event returns success response"""
        payload = {
            "EventType": "deal.paid",
            "DealId": "deal_123",
            "DateTime": "2026-01-16T12:00:00Z",
        }

        event = webhook_handler.parse_event(payload)
        response = webhook_handler.handle_event(event)

        assert response == {"Success": True}

    def test_raw_payload_preserved(self, webhook_handler):
        """Test that raw payload is preserved in event"""
        payload = {
            "EventType": "deal.paid",
            "DealId": "deal_123",
            "CustomField": "custom_value",
            "NestedData": {"key": "value"},
        }

        event = webhook_handler.parse_event(payload)

        assert event.raw_payload == payload
        assert event.raw_payload["CustomField"] == "custom_value"

    def test_split_completed_event(self, webhook_handler):
        """Test parsing split completed webhook"""
        payload = {
            "EventType": "split.completed",
            "DealId": "deal_123",
            "Amount": 60000000,
            "DateTime": "2026-01-16T17:00:00Z",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.SPLIT_COMPLETED

    def test_refunded_status_mapping(self, webhook_handler):
        """Test refunded status maps correctly"""
        payload = {
            "Status": "REFUNDED",
            "DealId": "deal_123",
        }

        event = webhook_handler.parse_event(payload)

        assert event.event_type == WebhookEventType.PAYMENT_REFUNDED


class TestWebhookSignatureVerification:
    """Tests for webhook signature verification"""

    def test_verify_signature_no_secret(self):
        """Test verification skipped when no secret configured"""
        handler = TBankWebhookHandler(secret_key="")

        payload = {"DealId": "deal_123"}
        result = handler.verify_signature(payload, "any_signature")

        # Should return True when no secret configured
        assert result is True

    def test_verify_signature_no_signature_provided(self, webhook_handler):
        """Test verification fails when no signature in payload"""
        payload = {"DealId": "deal_123"}

        result = webhook_handler.verify_signature(payload)

        assert result is False

    def test_verify_signature_from_payload_token(self, webhook_handler):
        """Test signature can be taken from payload Token field"""
        # Generate expected signature
        payload = {"DealId": "deal_123", "Amount": "10000"}

        # Calculate expected signature manually
        expected = webhook_handler._generate_signature(payload)

        payload["Token"] = expected

        result = webhook_handler.verify_signature(payload)

        assert result is True

    def test_verify_signature_invalid(self, webhook_handler):
        """Test verification fails with invalid signature"""
        payload = {"DealId": "deal_123"}

        result = webhook_handler.verify_signature(payload, "invalid_signature")

        assert result is False
