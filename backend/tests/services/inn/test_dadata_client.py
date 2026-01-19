"""Tests for DaData client."""

import pytest

from app.services.inn import (
    DaDataClient,
    CompanyInfo,
    BankInfo,
    LegalType,
    CompanyStatus,
)


class TestDaDataClientMock:
    """Test DaData client in mock mode."""

    @pytest.fixture
    def client(self):
        """Create DaData client in mock mode."""
        client = DaDataClient()
        client.mock_mode = True
        return client

    @pytest.mark.asyncio
    async def test_find_by_inn_existing_company(self, client):
        """Test finding existing company by INN."""
        result = await client.find_by_inn("7707083893")

        assert result.success is True
        assert result.data is not None
        assert isinstance(result.data, CompanyInfo)
        assert result.data.inn == "7707083893"
        assert result.data.name == "ПАО Сбербанк"
        assert result.data.legal_type == LegalType.LEGAL
        assert result.data.status == CompanyStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_find_by_inn_individual(self, client):
        """Test finding individual entrepreneur by INN."""
        result = await client.find_by_inn("772879317683")

        assert result.success is True
        assert result.data is not None
        assert isinstance(result.data, CompanyInfo)
        assert result.data.inn == "772879317683"
        assert result.data.legal_type == LegalType.INDIVIDUAL
        assert result.data.kpp is None  # IPs don't have KPP

    @pytest.mark.asyncio
    async def test_find_by_inn_not_found(self, client):
        """Test finding non-existing company by INN."""
        result = await client.find_by_inn("0000000000")

        assert result.success is False
        assert result.data is None
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_find_bank_by_bik_existing(self, client):
        """Test finding existing bank by BIK."""
        result = await client.find_bank_by_bik("044525225")

        assert result.success is True
        assert result.data is not None
        assert isinstance(result.data, BankInfo)
        assert result.data.bik == "044525225"
        assert result.data.name == "Сбербанк"
        assert result.data.corr_account is not None

    @pytest.mark.asyncio
    async def test_find_bank_by_bik_not_found(self, client):
        """Test finding non-existing bank by BIK."""
        result = await client.find_bank_by_bik("000000000")

        assert result.success is False
        assert result.data is None
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_strip_whitespace_inn(self, client):
        """Test that INN whitespace is stripped."""
        result = await client.find_by_inn("  7707083893  ")

        assert result.success is True
        assert result.data.inn == "7707083893"

    @pytest.mark.asyncio
    async def test_strip_whitespace_bik(self, client):
        """Test that BIK whitespace is stripped."""
        result = await client.find_bank_by_bik("  044525225  ")

        assert result.success is True
        assert result.data.bik == "044525225"
