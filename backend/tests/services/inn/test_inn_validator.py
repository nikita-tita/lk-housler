"""Tests for INN checksum validation utilities"""

import pytest

from app.utils.inn_validator import (
    validate_inn_checksum,
    validate_inn,
    get_inn_type,
    is_self_employed_inn,
)


class TestINNChecksumValidation:
    """Tests for INN checksum validation (pure functions, no DB)"""

    # Valid test INNs (these are real checksum-valid INNs for testing)
    # 10-digit (legal entity)
    VALID_INN_10 = "7707083893"  # Sberbank
    VALID_INN_10_ALT = "5027089703"  # Another valid 10-digit

    # 12-digit (individual)
    VALID_INN_12 = "500100732259"  # Valid individual INN
    VALID_INN_12_ALT = "526317984689"  # Another valid 12-digit

    def test_valid_inn_10_digit(self):
        """Test valid 10-digit legal entity INN"""
        is_valid, error = validate_inn_checksum(self.VALID_INN_10)
        assert is_valid is True
        assert error is None

    def test_valid_inn_10_digit_alternate(self):
        """Test another valid 10-digit INN"""
        is_valid, error = validate_inn_checksum(self.VALID_INN_10_ALT)
        assert is_valid is True
        assert error is None

    def test_valid_inn_12_digit(self):
        """Test valid 12-digit individual INN"""
        is_valid, error = validate_inn_checksum(self.VALID_INN_12)
        assert is_valid is True
        assert error is None

    def test_valid_inn_12_digit_alternate(self):
        """Test another valid 12-digit INN"""
        is_valid, error = validate_inn_checksum(self.VALID_INN_12_ALT)
        assert is_valid is True
        assert error is None

    def test_invalid_inn_10_wrong_checksum(self):
        """Test 10-digit INN with wrong checksum"""
        invalid_inn = "7707083890"  # Changed last digit
        is_valid, error = validate_inn_checksum(invalid_inn)
        assert is_valid is False
        assert "checksum" in error.lower()

    def test_invalid_inn_12_wrong_checksum(self):
        """Test 12-digit INN with wrong checksum"""
        invalid_inn = "500100732250"  # Changed last digit
        is_valid, error = validate_inn_checksum(invalid_inn)
        assert is_valid is False
        assert "checksum" in error.lower()

    def test_invalid_inn_wrong_length_9(self):
        """Test INN with wrong length (9 digits)"""
        is_valid, error = validate_inn_checksum("770708389")
        assert is_valid is False
        assert "10 or 12" in error

    def test_invalid_inn_wrong_length_11(self):
        """Test INN with wrong length (11 digits)"""
        is_valid, error = validate_inn_checksum("77070838930")
        assert is_valid is False
        assert "10 or 12" in error

    def test_invalid_inn_wrong_length_13(self):
        """Test INN with wrong length (13 digits)"""
        is_valid, error = validate_inn_checksum("5001007322590")
        assert is_valid is False
        assert "10 or 12" in error

    def test_invalid_inn_non_numeric(self):
        """Test INN with non-numeric characters"""
        is_valid, error = validate_inn_checksum("770708389A")
        assert is_valid is False
        assert "10 or 12" in error

    def test_invalid_inn_empty_string(self):
        """Test empty INN string"""
        is_valid, error = validate_inn_checksum("")
        assert is_valid is False
        assert "10 or 12" in error

    def test_inn_with_whitespace(self):
        """Test INN with leading/trailing whitespace"""
        is_valid, error = validate_inn_checksum("  7707083893  ")
        assert is_valid is True
        assert error is None

    def test_inn_all_zeros_mathematically_valid(self):
        """Test INN with all zeros - mathematically valid checksum"""
        # All zeros has valid checksum (0 * weight = 0, 0 % 11 % 10 = 0)
        # In production, such INNs should be caught by blacklist/FNS check
        is_valid, error = validate_inn_checksum("0000000000")
        assert is_valid is True  # Mathematically valid

    def test_invalid_inn_all_nines(self):
        """Test INN with all nines"""
        is_valid, error = validate_inn_checksum("9999999999")
        assert is_valid is False  # Invalid checksum


class TestValidateINN:
    """Tests for validate_inn function that raises exceptions"""

    VALID_INN_10 = "7707083893"
    VALID_INN_12 = "500100732259"

    def test_validate_inn_returns_cleaned_value(self):
        """Test that validate_inn returns cleaned INN"""
        result = validate_inn("  7707083893  ")
        assert result == "7707083893"

    def test_validate_inn_raises_for_invalid(self):
        """Test that validate_inn raises ValueError for invalid INN"""
        with pytest.raises(ValueError, match="checksum"):
            validate_inn("7707083890")

    def test_validate_inn_raises_for_empty(self):
        """Test that validate_inn raises for empty string"""
        with pytest.raises(ValueError, match="required"):
            validate_inn("")

    def test_validate_inn_raises_for_none(self):
        """Test that validate_inn raises for None"""
        with pytest.raises(ValueError, match="required"):
            validate_inn(None)


class TestGetINNType:
    """Tests for INN type detection"""

    def test_get_inn_type_legal_entity(self):
        """Test detection of legal entity INN (10 digits)"""
        assert get_inn_type("7707083893") == "legal_entity"

    def test_get_inn_type_individual(self):
        """Test detection of individual INN (12 digits)"""
        assert get_inn_type("500100732259") == "individual"

    def test_get_inn_type_invalid(self):
        """Test detection returns None for invalid format"""
        assert get_inn_type("12345") is None
        assert get_inn_type("abc") is None
        assert get_inn_type("") is None

    def test_get_inn_type_with_whitespace(self):
        """Test type detection with whitespace"""
        assert get_inn_type("  7707083893  ") == "legal_entity"
        assert get_inn_type("  500100732259  ") == "individual"


class TestIsSelfEmployedINN:
    """Tests for self-employed INN detection"""

    def test_is_self_employed_inn_individual(self):
        """Test that 12-digit INN is considered self-employed eligible"""
        assert is_self_employed_inn("500100732259") is True

    def test_is_self_employed_inn_legal_entity(self):
        """Test that 10-digit INN is NOT self-employed eligible"""
        assert is_self_employed_inn("7707083893") is False

    def test_is_self_employed_inn_invalid(self):
        """Test that invalid INN returns False"""
        assert is_self_employed_inn("12345") is False
        assert is_self_employed_inn("") is False
