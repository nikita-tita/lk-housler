"""Tests for SplitService"""

import pytest
from decimal import Decimal

from app.services.bank_split.split_service import (
    SplitService,
    SplitRecipientInput,
)
from app.models.bank_split import RecipientRole, SplitType


class TestSplitCalculation:
    """Tests for split calculation logic (no DB required)"""

    def test_calculate_splits_simple_percent(self):
        """Test simple percent split between two recipients"""
        # Arrange
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("60"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                organization_id="550e8400-e29b-41d4-a716-446655440000",
                split_type=SplitType.PERCENT,
                split_value=Decimal("40"),
            ),
        ]
        total = Decimal("100000.00")

        # Act
        # Create service without DB for pure calculation test
        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        # Assert
        assert len(results) == 2
        assert results[0].calculated_amount == Decimal("60000.00")
        assert results[1].calculated_amount == Decimal("40000.00")
        assert sum(r.calculated_amount for r in results) == total

    def test_calculate_splits_with_rounding(self):
        """Test split with rounding (amounts don't divide evenly)"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("33.33"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                split_type=SplitType.PERCENT,
                split_value=Decimal("33.33"),
            ),
            SplitRecipientInput(
                role=RecipientRole.LEAD,
                split_type=SplitType.PERCENT,
                split_value=Decimal("33.34"),
            ),
        ]
        total = Decimal("100.00")

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        # Total should equal original amount (rounding adjustment)
        assert sum(r.calculated_amount for r in results) == total

    def test_calculate_splits_solo_agent(self):
        """Test 100% to single agent"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("100"),
            ),
        ]
        total = Decimal("50000.00")

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        assert len(results) == 1
        assert results[0].calculated_amount == total

    def test_calculate_splits_fixed_amount(self):
        """Test fixed amount split"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.PLATFORM_FEE,
                split_type=SplitType.FIXED,
                split_value=Decimal("5000.00"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("100"),
            ),
        ]
        total = Decimal("100000.00")

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        # Fixed amount first
        assert results[0].calculated_amount == Decimal("5000.00")
        # Percent from remaining
        assert results[1].calculated_amount == Decimal("95000.00")

    def test_validate_split_rules_invalid_percent_total(self):
        """Test validation fails when percent doesn't sum to 100"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                split_type=SplitType.PERCENT,
                split_value=Decimal("60"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                split_type=SplitType.PERCENT,
                split_value=Decimal("30"),  # Total = 90, not 100
            ),
        ]

        service = SplitService.__new__(SplitService)

        with pytest.raises(ValueError, match="must sum to 100"):
            service.validate_split_rules(recipients)

    def test_validate_split_rules_empty_recipients(self):
        """Test validation fails with no recipients"""
        service = SplitService.__new__(SplitService)

        with pytest.raises(ValueError, match="At least one"):
            service.validate_split_rules([])

    def test_calculate_splits_large_amount(self):
        """Test split with large commission amount"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("60"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                split_type=SplitType.PERCENT,
                split_value=Decimal("40"),
            ),
        ]
        total = Decimal("1500000.00")  # 1.5M rubles

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        assert results[0].calculated_amount == Decimal("900000.00")
        assert results[1].calculated_amount == Decimal("600000.00")
        assert sum(r.calculated_amount for r in results) == total

    def test_calculate_splits_small_amount(self):
        """Test split with small commission amount"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("70"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                split_type=SplitType.PERCENT,
                split_value=Decimal("30"),
            ),
        ]
        total = Decimal("1000.00")

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        assert results[0].calculated_amount == Decimal("700.00")
        assert results[1].calculated_amount == Decimal("300.00")

    def test_calculate_splits_three_way(self):
        """Test three-way split (agent, agency, platform)"""
        recipients = [
            SplitRecipientInput(
                role=RecipientRole.AGENT,
                user_id=1,
                split_type=SplitType.PERCENT,
                split_value=Decimal("55"),
            ),
            SplitRecipientInput(
                role=RecipientRole.AGENCY,
                split_type=SplitType.PERCENT,
                split_value=Decimal("40"),
            ),
            SplitRecipientInput(
                role=RecipientRole.PLATFORM_FEE,
                split_type=SplitType.PERCENT,
                split_value=Decimal("5"),
            ),
        ]
        total = Decimal("200000.00")

        service = SplitService.__new__(SplitService)
        results = service.calculate_splits(total, recipients)

        assert results[0].calculated_amount == Decimal("110000.00")
        assert results[1].calculated_amount == Decimal("80000.00")
        assert results[2].calculated_amount == Decimal("10000.00")
        assert sum(r.calculated_amount for r in results) == total
