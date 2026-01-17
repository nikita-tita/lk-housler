"""Russian INN (Taxpayer Identification Number) validation utilities.

INN validation rules:
- Individual (12 digits): 2 check digits calculated using weight coefficients
- Legal entity (10 digits): 1 check digit calculated using weight coefficients
"""

import re
from typing import Optional, Tuple


# Weight coefficients for INN checksum calculation
INN_10_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8]
INN_12_WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
INN_12_WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]


def _calculate_checksum(digits: list[int], weights: list[int]) -> int:
    """Calculate INN checksum using weight coefficients."""
    total = sum(d * w for d, w in zip(digits, weights))
    return total % 11 % 10


def validate_inn_checksum(inn: str) -> Tuple[bool, Optional[str]]:
    """
    Validate INN checksum.

    Args:
        inn: The INN string to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Remove any whitespace
    inn = inn.strip()

    # Check format
    if not re.match(r'^\d{10}$|^\d{12}$', inn):
        return False, "INN must be 10 or 12 digits"

    digits = [int(d) for d in inn]

    if len(inn) == 10:
        # Legal entity INN - 10 digits
        check_digit = _calculate_checksum(digits[:9], INN_10_WEIGHTS)
        if check_digit != digits[9]:
            return False, "Invalid INN checksum for legal entity"

    elif len(inn) == 12:
        # Individual INN - 12 digits
        # First check digit (11th position)
        check_digit_11 = _calculate_checksum(digits[:10], INN_12_WEIGHTS_11)
        if check_digit_11 != digits[10]:
            return False, "Invalid INN checksum (digit 11) for individual"

        # Second check digit (12th position)
        check_digit_12 = _calculate_checksum(digits[:11], INN_12_WEIGHTS_12)
        if check_digit_12 != digits[11]:
            return False, "Invalid INN checksum (digit 12) for individual"

    return True, None


def validate_inn(inn: str) -> str:
    """
    Validate INN and return cleaned value.

    Args:
        inn: The INN string to validate

    Returns:
        Cleaned INN string

    Raises:
        ValueError: If INN is invalid
    """
    if not inn:
        raise ValueError("INN is required")

    # Clean the input
    inn = inn.strip()

    # Validate checksum
    is_valid, error = validate_inn_checksum(inn)
    if not is_valid:
        raise ValueError(error)

    return inn


def get_inn_type(inn: str) -> Optional[str]:
    """
    Determine INN type.

    Args:
        inn: The INN string

    Returns:
        'individual' for 12-digit INN, 'legal_entity' for 10-digit INN, None if invalid
    """
    inn = inn.strip()

    if re.match(r'^\d{12}$', inn):
        return 'individual'
    elif re.match(r'^\d{10}$', inn):
        return 'legal_entity'
    return None


def is_self_employed_inn(inn: str) -> bool:
    """
    Check if INN belongs to an individual (potential self-employed).

    Self-employed workers must have 12-digit individual INN.

    Args:
        inn: The INN string

    Returns:
        True if INN is valid 12-digit individual INN
    """
    return get_inn_type(inn) == 'individual'
