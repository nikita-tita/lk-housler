"""Tests for INNValidationService"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.services.inn.validation import (
    INNValidationService,
    INNValidationLevel,
    INNValidationStatus,
    INNValidationResult,
)
from app.integrations.fns.npd_status import NPDStatus, NPDCheckResult


class TestINNValidationServiceChecksumOnly:
    """Tests for checksum-only validation (no DB required)"""

    # Valid test INNs
    VALID_INN_10 = "7707083893"  # Sberbank (legal entity)
    VALID_INN_12 = "500100732259"  # Individual

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session"""
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        """Create service instance with mock DB"""
        return INNValidationService(mock_db)

    @pytest.mark.asyncio
    async def test_validate_checksum_only_valid_10(self, service):
        """Test checksum validation for valid 10-digit INN"""
        result = await service.validate(
            self.VALID_INN_10,
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        assert result.checksum_valid is True
        assert result.inn_type == "legal_entity"
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_validate_checksum_only_valid_12(self, service):
        """Test checksum validation for valid 12-digit INN"""
        result = await service.validate(
            self.VALID_INN_12,
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        assert result.checksum_valid is True
        assert result.inn_type == "individual"

    @pytest.mark.asyncio
    async def test_validate_invalid_checksum(self, service):
        """Test validation fails for invalid checksum"""
        result = await service.validate(
            "7707083890",  # Wrong checksum
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.INVALID_FORMAT
        assert result.checksum_valid is False
        assert len(result.errors) > 0

    @pytest.mark.asyncio
    async def test_validate_empty_inn(self, service):
        """Test validation fails for empty INN"""
        result = await service.validate(
            "",
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.INVALID_FORMAT
        assert "required" in result.errors[0].lower()

    @pytest.mark.asyncio
    async def test_validate_none_inn(self, service):
        """Test validation fails for None INN"""
        result = await service.validate(
            None,
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.INVALID_FORMAT

    @pytest.mark.asyncio
    async def test_validate_strips_whitespace(self, service):
        """Test that whitespace is stripped from INN"""
        result = await service.validate(
            "  7707083893  ",
            level=INNValidationLevel.CHECKSUM_ONLY
        )

        assert result.is_valid is True
        assert result.inn == "7707083893"


class TestINNValidationServiceBasic:
    """Tests for basic validation (checksum + blacklist)"""

    VALID_INN_10 = "7707083893"
    VALID_INN_12 = "500100732259"

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session"""
        db = AsyncMock()
        # Default: not blacklisted
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        return db

    @pytest.fixture
    def service(self, mock_db):
        return INNValidationService(mock_db)

    @pytest.mark.asyncio
    async def test_validate_basic_not_blacklisted(self, service):
        """Test basic validation passes when not blacklisted"""
        result = await service.validate(
            self.VALID_INN_10,
            level=INNValidationLevel.BASIC
        )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        assert result.is_blacklisted is False

    @pytest.mark.asyncio
    async def test_validate_basic_blacklisted(self, mock_db):
        """Test basic validation fails when blacklisted"""
        # Mock blacklist entry found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()  # Entry exists
        mock_db.execute.return_value = mock_result

        service = INNValidationService(mock_db)
        result = await service.validate(
            self.VALID_INN_10,
            level=INNValidationLevel.BASIC
        )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.BLACKLISTED
        assert result.is_blacklisted is True
        assert "blacklist" in result.errors[0].lower()


class TestINNValidationServiceFull:
    """Tests for full validation (checksum + blacklist + NPD)"""

    VALID_INN_10 = "7707083893"  # Legal entity
    VALID_INN_12 = "500100732259"  # Individual

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session"""
        db = AsyncMock()
        # Default: not blacklisted
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        return db

    @pytest.fixture
    def service(self, mock_db):
        return INNValidationService(mock_db)

    @pytest.mark.asyncio
    async def test_validate_full_npd_registered(self, service):
        """Test full validation passes when NPD is registered"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.REGISTERED,
            registration_date=datetime(2023, 1, 15),
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            result = await service.validate(
                self.VALID_INN_12,
                level=INNValidationLevel.FULL
            )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        assert result.npd_status == NPDStatus.REGISTERED
        assert result.npd_registration_date == datetime(2023, 1, 15)

    @pytest.mark.asyncio
    async def test_validate_full_npd_not_registered_no_requirement(self, service):
        """Test full validation passes when NPD not registered but not required"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.NOT_REGISTERED,
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            result = await service.validate(
                self.VALID_INN_12,
                level=INNValidationLevel.FULL,
                require_self_employed=False
            )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        assert result.npd_status == NPDStatus.NOT_REGISTERED
        # Should have warning
        assert len(result.warnings) > 0
        assert "not registered" in result.warnings[0].lower()

    @pytest.mark.asyncio
    async def test_validate_full_npd_not_registered_required(self, service):
        """Test full validation fails when NPD required but not registered"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.NOT_REGISTERED,
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            result = await service.validate(
                self.VALID_INN_12,
                level=INNValidationLevel.FULL,
                require_self_employed=True
            )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.NPD_NOT_REGISTERED
        assert len(result.errors) > 0

    @pytest.mark.asyncio
    async def test_validate_full_npd_error_not_required(self, service):
        """Test full validation passes when NPD check fails but not required"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.ERROR,
            error_message="FNS API unavailable",
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            result = await service.validate(
                self.VALID_INN_12,
                level=INNValidationLevel.FULL,
                require_self_employed=False
            )

        assert result.is_valid is True
        assert result.status == INNValidationStatus.VALID
        # Should have warning about check failure
        assert len(result.warnings) > 0

    @pytest.mark.asyncio
    async def test_validate_full_npd_error_required(self, service):
        """Test full validation fails when NPD check fails and required"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.ERROR,
            error_message="FNS API unavailable",
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            result = await service.validate(
                self.VALID_INN_12,
                level=INNValidationLevel.FULL,
                require_self_employed=True
            )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.NPD_CHECK_FAILED

    @pytest.mark.asyncio
    async def test_validate_full_legal_entity_no_npd_check(self, service):
        """Test that legal entity INN skips NPD check"""
        with patch('app.services.inn.validation.check_npd_status') as mock_npd:
            result = await service.validate(
                self.VALID_INN_10,
                level=INNValidationLevel.FULL
            )

        # NPD should NOT be called for legal entity
        mock_npd.assert_not_called()
        assert result.is_valid is True
        assert result.inn_type == "legal_entity"
        assert result.npd_status is None


class TestINNValidationServiceRoleBased:
    """Tests for role-based validation (agent vs agency)"""

    VALID_INN_10 = "7707083893"  # Legal entity
    VALID_INN_12 = "500100732259"  # Individual

    @pytest.fixture
    def mock_db(self):
        """Create mock async database session"""
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute.return_value = mock_result
        return db

    @pytest.fixture
    def service(self, mock_db):
        return INNValidationService(mock_db)

    @pytest.mark.asyncio
    async def test_validate_agent_role_individual_inn(self, service):
        """Test agent validation with individual INN (correct)"""
        npd_result = NPDCheckResult(
            inn=self.VALID_INN_12,
            status=NPDStatus.REGISTERED,
        )

        with patch('app.services.inn.validation.check_npd_status', return_value=npd_result):
            with patch.object(type(service), '_check_blacklist', return_value=False):
                result = await service.validate_recipient_inn(
                    self.VALID_INN_12,
                    role="agent"
                )

        assert result.is_valid is True
        assert result.inn_type == "individual"

    @pytest.mark.asyncio
    async def test_validate_agency_role_legal_entity_inn(self, service):
        """Test agency validation with legal entity INN (correct)"""
        result = await service.validate_recipient_inn(
            self.VALID_INN_10,
            role="agency"
        )

        assert result.is_valid is True
        assert result.inn_type == "legal_entity"

    @pytest.mark.asyncio
    async def test_validate_agency_role_individual_inn(self, service):
        """Test agency validation with individual INN (incorrect)"""
        result = await service.validate_recipient_inn(
            self.VALID_INN_12,
            role="agency"
        )

        assert result.is_valid is False
        assert result.status == INNValidationStatus.INVALID_FORMAT
        assert "legal entity" in result.errors[0].lower()

    @pytest.mark.asyncio
    async def test_validate_client_role_any_inn(self, service):
        """Test client role accepts any valid INN"""
        # Legal entity
        result1 = await service.validate_recipient_inn(
            self.VALID_INN_10,
            role="client"
        )
        assert result1.is_valid is True

        # Individual
        result2 = await service.validate_recipient_inn(
            self.VALID_INN_12,
            role="client"
        )
        assert result2.is_valid is True


class TestINNValidationResult:
    """Tests for INNValidationResult dataclass"""

    def test_result_defaults(self):
        """Test default values in result"""
        result = INNValidationResult(
            inn="123456789012",
            status=INNValidationStatus.VALID,
        )

        assert result.is_valid is False  # Default
        assert result.checksum_valid is False  # Default
        assert result.is_blacklisted is False  # Default
        assert result.npd_status is None
        assert result.errors == []
        assert result.warnings == []
        assert result.checked_at is not None

    def test_result_with_errors(self):
        """Test result with errors"""
        result = INNValidationResult(
            inn="invalid",
            status=INNValidationStatus.INVALID_FORMAT,
            errors=["INN must be 10 or 12 digits"],
        )

        assert result.is_valid is False
        assert len(result.errors) == 1

    def test_result_with_warnings(self):
        """Test result with warnings"""
        result = INNValidationResult(
            inn="500100732259",
            status=INNValidationStatus.VALID,
            is_valid=True,
            checksum_valid=True,
            warnings=["Taxpayer is not registered as self-employed"],
        )

        assert result.is_valid is True
        assert len(result.warnings) == 1
