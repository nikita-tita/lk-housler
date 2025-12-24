"""PII Encryption for 152-ФЗ compliance"""

import base64
import hashlib
import logging
from typing import Optional, Tuple
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend

from app.core.config import settings

logger = logging.getLogger(__name__)


class PIIEncryption:
    """PII (Personal Identifiable Information) encryption service"""

    def __init__(self):
        # Derive Fernet key from ENCRYPTION_KEY
        if not settings.ENCRYPTION_KEY:
            raise ValueError("ENCRYPTION_KEY not set in environment")

        key_bytes = bytes.fromhex(settings.ENCRYPTION_KEY)

        # Get salt from settings (configurable for production)
        salt = settings.ENCRYPTION_SALT.encode('utf-8')

        # Use PBKDF2HMAC to derive a Fernet-compatible key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
            backend=default_backend()
        )
        fernet_key = Fernet(base64.urlsafe_b64encode(kdf.derive(key_bytes)))
        self.cipher = fernet_key

    def encrypt(self, plaintext: str) -> str:
        """Encrypt PII data (email, phone, name, etc.)"""
        if not plaintext:
            return ""

        try:
            encrypted = self.cipher.encrypt(plaintext.encode())
            return encrypted.decode('utf-8')
        except Exception:
            logger.exception("Encryption failed")
            return ""

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt PII data"""
        if not ciphertext:
            return ""

        try:
            decrypted = self.cipher.decrypt(ciphertext.encode())
            return decrypted.decode('utf-8')
        except Exception:
            logger.exception("Decryption failed")
            return ""

    @staticmethod
    def hash(value: str) -> str:
        """Create SHA-256 hash for searching (не расшифровывается)"""
        if not value:
            return ""
        return hashlib.sha256(value.encode()).hexdigest()


# Global instance
pii_encryption = PIIEncryption()


def encrypt_email(email: str) -> tuple[str, str]:
    """Encrypt email and create search hash
    
    Returns:
        (encrypted, hash) - both as strings
    """
    return (
        pii_encryption.encrypt(email.lower()),
        pii_encryption.hash(email.lower())
    )


def decrypt_email(encrypted: str) -> str:
    """Decrypt email"""
    return pii_encryption.decrypt(encrypted)


def encrypt_phone(phone: str) -> tuple[str, str]:
    """Encrypt phone and create search hash
    
    Returns:
        (encrypted, hash) - both as strings
    """
    # Normalize phone: remove spaces, dashes, etc.
    normalized = ''.join(filter(str.isdigit, phone))
    return (
        pii_encryption.encrypt(normalized),
        pii_encryption.hash(normalized)
    )


def decrypt_phone(encrypted: str) -> str:
    """Decrypt phone"""
    return pii_encryption.decrypt(encrypted)


def encrypt_name(name: str) -> str:
    """Encrypt name (no hash needed)"""
    return pii_encryption.encrypt(name)


def decrypt_name(encrypted: str) -> str:
    """Decrypt name"""
    return pii_encryption.decrypt(encrypted)


def encrypt_inn(inn: str) -> tuple[str, str]:
    """Encrypt INN and create search hash
    
    Returns:
        (encrypted, hash) - both as strings
    """
    normalized = ''.join(filter(str.isdigit, inn))
    return (
        pii_encryption.encrypt(normalized),
        pii_encryption.hash(normalized)
    )


def decrypt_inn(encrypted: str) -> str:
    """Decrypt INN"""
    return pii_encryption.decrypt(encrypted)


# =============================================================================
# Passport encryption (152-ФЗ - высокочувствительные данные)
# =============================================================================

def encrypt_passport(series: str, number: str) -> Tuple[str, str, str]:
    """Encrypt passport series and number, create combined hash for search

    Returns:
        (series_encrypted, number_encrypted, combined_hash)
    """
    # Normalize: only digits
    series_norm = ''.join(filter(str.isdigit, series)) if series else ""
    number_norm = ''.join(filter(str.isdigit, number)) if number else ""

    series_enc = pii_encryption.encrypt(series_norm) if series_norm else ""
    number_enc = pii_encryption.encrypt(number_norm) if number_norm else ""

    # Combined hash for duplicate detection (серия+номер)
    combined = f"{series_norm}{number_norm}"
    combined_hash = pii_encryption.hash(combined) if combined else ""

    return series_enc, number_enc, combined_hash


def decrypt_passport_series(encrypted: str) -> str:
    """Decrypt passport series"""
    return pii_encryption.decrypt(encrypted)


def decrypt_passport_number(encrypted: str) -> str:
    """Decrypt passport number"""
    return pii_encryption.decrypt(encrypted)


def encrypt_passport_issued_by(issued_by: str) -> str:
    """Encrypt passport issued by field"""
    return pii_encryption.encrypt(issued_by) if issued_by else ""


def decrypt_passport_issued_by(encrypted: str) -> str:
    """Decrypt passport issued by field"""
    return pii_encryption.decrypt(encrypted)

