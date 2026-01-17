"""Tests for TBank mock client"""

import pytest
from decimal import Decimal

from app.integrations.tbank.mock import MockTBankDealsClient
from app.integrations.tbank.deals import TBankDealSplit, DealStatus


@pytest.fixture
def mock_client():
    """Create mock T-Bank client"""
    client = MockTBankDealsClient()
    yield client
    client.clear()


class TestMockTBankDealsClient:
    """Tests for MockTBankDealsClient"""

    @pytest.mark.asyncio
    async def test_health_check(self, mock_client):
        """Test health check always returns True"""
        result = await mock_client.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_create_recipient(self, mock_client):
        """Test creating a recipient"""
        recipient = await mock_client.create_recipient(
            inn="123456789012",
            name="Test Agent",
            phone="+79001234567",
        )

        assert recipient.external_id.startswith("mock_rcpt_")
        assert recipient.inn == "123456789012"
        assert recipient.name == "Test Agent"
        assert recipient.phone == "+79001234567"

    @pytest.mark.asyncio
    async def test_get_recipient(self, mock_client):
        """Test getting a recipient"""
        # Create first
        created = await mock_client.create_recipient(
            inn="123456789012",
            name="Test Agent",
        )

        # Get
        retrieved = await mock_client.get_recipient(created.external_id)

        assert retrieved.external_id == created.external_id
        assert retrieved.inn == created.inn

    @pytest.mark.asyncio
    async def test_create_deal(self, mock_client):
        """Test creating a deal"""
        # Create recipient first
        recipient = await mock_client.create_recipient(
            inn="123456789012",
            name="Test Agent",
        )

        # Create deal
        splits = [
            TBankDealSplit(
                recipient_id=recipient.external_id,
                amount=10000000,  # 100,000 rubles in kopecks
                description="Agent commission",
            )
        ]

        deal = await mock_client.create_deal(
            order_id="test-order-123",
            amount=10000000,
            description="Test deal",
            splits=splits,
            customer_email="test@example.com",
        )

        assert deal.deal_id.startswith("mock_deal_")
        assert deal.amount == 10000000
        assert deal.status == DealStatus.ACTIVE
        assert deal.payment_url is not None
        assert deal.qr_code is not None
        assert deal.expires_at is not None

    @pytest.mark.asyncio
    async def test_get_deal(self, mock_client):
        """Test getting a deal"""
        # Create
        recipient = await mock_client.create_recipient(inn="123456789012", name="Test")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]

        created = await mock_client.create_deal(
            order_id="test-123",
            amount=10000000,
            description="Test",
            splits=splits,
        )

        # Get
        retrieved = await mock_client.get_deal(created.deal_id)

        assert retrieved.deal_id == created.deal_id
        assert retrieved.amount == created.amount

    @pytest.mark.asyncio
    async def test_cancel_deal(self, mock_client):
        """Test cancelling a deal"""
        recipient = await mock_client.create_recipient(inn="123456789012", name="Test")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]

        deal = await mock_client.create_deal(
            order_id="test-123",
            amount=10000000,
            description="Test",
            splits=splits,
        )

        # Cancel
        cancelled = await mock_client.cancel_deal(deal.deal_id, reason="Test cancellation")

        assert cancelled.status == DealStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_simulate_payment_flow(self, mock_client):
        """Test full payment simulation flow"""
        # Setup
        recipient = await mock_client.create_recipient(inn="123456789012", name="Test")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]

        deal = await mock_client.create_deal(
            order_id="test-123",
            amount=10000000,
            description="Test",
            splits=splits,
        )

        assert deal.status == DealStatus.ACTIVE
        assert deal.paid_at is None

        # Simulate payment
        mock_client.simulate_payment(deal.deal_id)

        # Check status changed
        updated = await mock_client.get_deal(deal.deal_id)
        assert updated.status == DealStatus.HOLD
        assert updated.paid_at is not None

        # Simulate release
        mock_client.simulate_release(deal.deal_id)

        # Check final status
        final = await mock_client.get_deal(deal.deal_id)
        assert final.status == DealStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_regenerate_payment_link(self, mock_client):
        """Test regenerating payment link"""
        recipient = await mock_client.create_recipient(inn="123456789012", name="Test")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]

        deal = await mock_client.create_deal(
            order_id="test-123",
            amount=10000000,
            description="Test",
            splits=splits,
        )

        old_url = deal.payment_url

        # Regenerate
        new_url = await mock_client.regenerate_payment_link(deal.deal_id)

        assert new_url != old_url
        assert "mock.tbank.ru/pay" in new_url

    @pytest.mark.asyncio
    async def test_release_deal(self, mock_client):
        """Test releasing deal from hold"""
        recipient = await mock_client.create_recipient(inn="123456789012", name="Test")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]

        deal = await mock_client.create_deal(
            order_id="test-123",
            amount=10000000,
            description="Test",
            splits=splits,
        )

        # Simulate payment to get to HOLD state
        mock_client.simulate_payment(deal.deal_id)

        # Release
        released = await mock_client.release_deal(deal.deal_id)

        assert released.status == DealStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_clear_mock_data(self, mock_client):
        """Test clearing all mock data"""
        # Create some data
        await mock_client.create_recipient(inn="123456789012", name="Test")
        recipient = await mock_client.create_recipient(inn="987654321098", name="Test2")
        splits = [TBankDealSplit(recipient_id=recipient.external_id, amount=10000000)]
        await mock_client.create_deal(order_id="test", amount=10000000, description="Test", splits=splits)

        assert len(mock_client.get_all_recipients()) == 2
        assert len(mock_client.get_all_deals()) == 1

        # Clear
        mock_client.clear()

        assert len(mock_client.get_all_recipients()) == 0
        assert len(mock_client.get_all_deals()) == 0
