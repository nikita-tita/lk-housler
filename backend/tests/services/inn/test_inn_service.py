"""Tests for INN service."""

import pytest

from app.services.inn import INNService, LegalType, CompanyStatus


class TestINNService:
    """Test INN lookup service."""

    @pytest.fixture
    def service(self):
        """Create INN service with mock DaData client."""
        return INNService()

    @pytest.mark.asyncio
    async def test_validate_inn_valid_legal_entity(self, service):
        """Test validating valid 10-digit INN."""
        result = await service.validate_inn("7707083893")

        assert result.valid is True
        assert result.inn_type == "legal_entity"
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_validate_inn_valid_individual(self, service):
        """Test validating valid 12-digit INN."""
        result = await service.validate_inn("772879317683")

        assert result.valid is True
        assert result.inn_type == "individual"
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_validate_inn_invalid_checksum(self, service):
        """Test validating INN with invalid checksum."""
        result = await service.validate_inn("1234567890")

        assert result.valid is False
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_validate_inn_invalid_length(self, service):
        """Test validating INN with invalid length."""
        result = await service.validate_inn("123456")

        assert result.valid is False
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_validate_inn_strip_whitespace(self, service):
        """Test that validation strips whitespace."""
        result = await service.validate_inn("  7707083893  ")

        assert result.valid is True

    @pytest.mark.asyncio
    async def test_lookup_company_success(self, service):
        """Test successful company lookup."""
        result = await service.lookup_company("7707083893")

        assert result.success is True
        assert result.company is not None
        assert result.company.inn == "7707083893"
        assert result.company.name == "ПАО Сбербанк"

    @pytest.mark.asyncio
    async def test_lookup_company_invalid_inn(self, service):
        """Test company lookup with invalid INN."""
        result = await service.lookup_company("1234567890")

        assert result.success is False
        assert result.company is None
        assert result.error_message is not None

    @pytest.mark.asyncio
    async def test_lookup_company_not_found(self, service):
        """Test company lookup for non-existing company."""
        # Valid checksum but not in mock data
        result = await service.lookup_company("7727563778")

        assert result.success is False
        assert result.company is None

    @pytest.mark.asyncio
    async def test_lookup_bank_success(self, service):
        """Test successful bank lookup."""
        result = await service.lookup_bank("044525225")

        assert result.success is True
        assert result.bank is not None
        assert result.bank.bik == "044525225"
        assert result.bank.name == "Сбербанк"

    @pytest.mark.asyncio
    async def test_lookup_bank_invalid_format(self, service):
        """Test bank lookup with invalid BIK format."""
        result = await service.lookup_bank("12345")

        assert result.success is False
        assert result.bank is None
        assert "9 digits" in result.error_message

    @pytest.mark.asyncio
    async def test_lookup_bank_not_found(self, service):
        """Test bank lookup for non-existing bank."""
        result = await service.lookup_bank("000000000")

        assert result.success is False
        assert result.bank is None

    @pytest.mark.asyncio
    async def test_autofill_profile_success(self, service):
        """Test autofill profile data."""
        data = await service.autofill_profile("5190237491")

        assert "error" not in data
        assert data["company_inn"] == "5190237491"
        assert data["company_name"] == 'ООО "Сектор ИТ"'
        assert data["company_kpp"] == "519001001"
        assert data["is_individual"] is False
        assert data["is_active"] is True

    @pytest.mark.asyncio
    async def test_autofill_profile_individual(self, service):
        """Test autofill profile for individual."""
        data = await service.autofill_profile("772879317683")

        assert "error" not in data
        assert data["company_inn"] == "772879317683"
        assert data["is_individual"] is True
        assert data["company_kpp"] == ""  # IPs don't have KPP

    @pytest.mark.asyncio
    async def test_autofill_profile_not_found(self, service):
        """Test autofill profile for non-existing company."""
        data = await service.autofill_profile("7727563778")

        assert "error" in data
        assert data["company_inn"] == "7727563778"

    @pytest.mark.asyncio
    async def test_autofill_bank_success(self, service):
        """Test autofill bank data."""
        data = await service.autofill_bank("044525974")

        assert "error" not in data
        assert data["bank_bik"] == "044525974"
        assert data["bank_name"] == "Т-Банк"
        assert data["bank_corr_account"] is not None

    @pytest.mark.asyncio
    async def test_autofill_bank_not_found(self, service):
        """Test autofill bank for non-existing bank."""
        data = await service.autofill_bank("000000000")

        assert "error" in data
        assert data["bank_bik"] == "000000000"
