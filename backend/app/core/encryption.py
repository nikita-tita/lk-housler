"""PII Encryption for 152-ФЗ compliance

Uses housler-crypto library for unified encryption across Housler ecosystem.
See: /Users/fatbookpro/Desktop/housler-crypto/README.md
"""

import logging
from typing import Tuple

from housler_crypto import HouslerCrypto, mask, normalize_phone

from app.core.config import settings

logger = logging.getLogger(__name__)


# Initialize crypto instance
_crypto: HouslerCrypto = None


def _get_crypto() -> HouslerCrypto:
    """Lazy initialization of crypto instance"""
    global _crypto
    if _crypto is None:
        if not settings.HOUSLER_CRYPTO_KEY:
            raise ValueError("HOUSLER_CRYPTO_KEY not set in environment")
        _crypto = HouslerCrypto(master_key=settings.HOUSLER_CRYPTO_KEY)
    return _crypto


# =============================================================================
# Email encryption
# =============================================================================


def encrypt_email(email: str) -> Tuple[str, str]:
    """Encrypt email and create blind index for search

    Returns:
        (encrypted, hash) - both as strings
    """
    if not email:
        return "", ""

    crypto = _get_crypto()
    normalized = email.lower().strip()
    return (crypto.encrypt(normalized, field="email"), crypto.blind_index(normalized, field="email"))


def decrypt_email(encrypted: str) -> str:
    """Decrypt email"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="email")


# =============================================================================
# Phone encryption
# =============================================================================


def encrypt_phone(phone: str) -> Tuple[str, str]:
    """Encrypt phone and create blind index for search

    Returns:
        (encrypted, hash) - both as strings
    """
    if not phone:
        return "", ""

    crypto = _get_crypto()
    normalized = normalize_phone(phone)
    return (crypto.encrypt(normalized, field="phone"), crypto.blind_index(normalized, field="phone"))


def decrypt_phone(encrypted: str) -> str:
    """Decrypt phone"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="phone")


# =============================================================================
# Name encryption
# =============================================================================


def encrypt_name(name: str) -> str:
    """Encrypt name (no hash needed - not searchable)"""
    if not name:
        return ""
    return _get_crypto().encrypt(name.strip(), field="name")


def decrypt_name(encrypted: str) -> str:
    """Decrypt name"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="name")


# =============================================================================
# INN encryption
# =============================================================================


def encrypt_inn(inn: str) -> Tuple[str, str]:
    """Encrypt INN and create blind index for search

    Returns:
        (encrypted, hash) - both as strings
    """
    if not inn:
        return "", ""

    crypto = _get_crypto()
    # Normalize: only digits
    normalized = "".join(filter(str.isdigit, inn))
    return (crypto.encrypt(normalized, field="inn"), crypto.blind_index(normalized, field="inn"))


def decrypt_inn(encrypted: str) -> str:
    """Decrypt INN"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="inn")


# =============================================================================
# Passport encryption (152-ФЗ - высокочувствительные данные)
# =============================================================================


def encrypt_passport(series: str, number: str) -> Tuple[str, str, str]:
    """Encrypt passport series and number, create combined hash for search

    Returns:
        (series_encrypted, number_encrypted, combined_hash)
    """
    crypto = _get_crypto()

    # Normalize: only digits
    series_norm = "".join(filter(str.isdigit, series)) if series else ""
    number_norm = "".join(filter(str.isdigit, number)) if number else ""

    series_enc = crypto.encrypt(series_norm, field="passport_series") if series_norm else ""
    number_enc = crypto.encrypt(number_norm, field="passport_number") if number_norm else ""

    # Combined hash for duplicate detection (серия+номер)
    combined = f"{series_norm}{number_norm}"
    combined_hash = crypto.blind_index(combined, field="passport") if combined else ""

    return series_enc, number_enc, combined_hash


def decrypt_passport_series(encrypted: str) -> str:
    """Decrypt passport series"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="passport_series")


def decrypt_passport_number(encrypted: str) -> str:
    """Decrypt passport number"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="passport_number")


def encrypt_passport_issued_by(issued_by: str) -> str:
    """Encrypt passport issued by field"""
    if not issued_by:
        return ""
    return _get_crypto().encrypt(issued_by, field="passport_issued_by")


def decrypt_passport_issued_by(encrypted: str) -> str:
    """Decrypt passport issued by field"""
    if not encrypted:
        return ""
    return _get_crypto().decrypt(encrypted, field="passport_issued_by")


# =============================================================================
# Masking for logs (re-export from housler_crypto)
# =============================================================================

mask_email = mask.email
mask_phone = mask.phone
mask_name = mask.name
mask_inn = mask.inn
mask_card = mask.card


# =============================================================================
# Legacy compatibility (deprecated)
# =============================================================================


class PIIEncryption:
    """Legacy class for backwards compatibility.

    DEPRECATED: Use encrypt_* / decrypt_* functions directly.
    """

    def __init__(self):
        self._crypto = _get_crypto()

    def encrypt(self, plaintext: str) -> str:
        """Generic encrypt - use field-specific functions instead"""
        if not plaintext:
            return ""
        return self._crypto.encrypt(plaintext, field="generic")

    def decrypt(self, ciphertext: str) -> str:
        """Generic decrypt"""
        if not ciphertext:
            return ""
        return self._crypto.decrypt(ciphertext, field="generic")

    @staticmethod
    def hash(value: str) -> str:
        """Create blind index"""
        if not value:
            return ""
        return _get_crypto().blind_index(value, field="generic")


# Legacy global instance (deprecated)
pii_encryption = None  # Will be initialized on first use


def _get_pii_encryption() -> PIIEncryption:
    """Lazy initialization for legacy compatibility"""
    global pii_encryption
    if pii_encryption is None:
        pii_encryption = PIIEncryption()
    return pii_encryption
