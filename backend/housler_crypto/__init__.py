"""
Housler Crypto - Unified PII Encryption for 152-FZ Compliance

Supports:
- AES-256-GCM authenticated encryption
- Per-field key derivation (PBKDF2-SHA256)
- BLAKE2b keyed blind index for searchable encryption
- Cross-platform compatibility with TypeScript version

Usage:
    from housler_crypto import HouslerCrypto

    crypto = HouslerCrypto(master_key="<64-hex-chars>")

    # Encrypt PII
    encrypted = crypto.encrypt("user@example.com", field="email")

    # Decrypt
    decrypted = crypto.decrypt(encrypted, field="email")

    # Blind index for search
    hash_value = crypto.blind_index("user@example.com", field="email")
"""

from .core import HouslerCrypto
from .migration import FernetMigrator
from .utils import mask, normalize_email, normalize_phone

__version__ = "1.0.0"
__all__ = [
    "HouslerCrypto",
    "mask",
    "normalize_phone",
    "normalize_email",
    "FernetMigrator",
]
