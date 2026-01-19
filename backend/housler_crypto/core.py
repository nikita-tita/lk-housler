"""
Core encryption module using AES-256-GCM.

Format: base64(version + iv + tag + ciphertext)
- version: 1 byte (0x01 for GCM)
- iv: 12 bytes (96 bits, recommended for GCM)
- tag: 16 bytes (128 bits, authentication tag)
- ciphertext: variable length

This format is cross-platform compatible with the TypeScript version.
"""

import base64
import hashlib
import logging
import os
import struct

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)

# Constants
VERSION_GCM = 0x01
IV_LENGTH = 12  # 96 bits for GCM (recommended)
TAG_LENGTH = 16  # 128 bits
KEY_LENGTH = 32  # 256 bits

# Prefix for encrypted data
ENCRYPTED_PREFIX = "hc1:"  # housler-crypto v1


class HouslerCrypto:
    """
    Unified PII encryption service for Housler ecosystem.

    Uses AES-256-GCM with per-field key derivation.

    Features:
    - Authenticated encryption (GCM mode)
    - Per-field keys derived from master key
    - BLAKE2b keyed blind index for search
    - Cross-platform format (compatible with TypeScript)

    Args:
        master_key: 32-byte hex-encoded key (64 characters)
        salt: Optional salt for key derivation (default: "housler_crypto_v1")
        iterations: PBKDF2 iterations (default: 100000)
    """

    def __init__(
        self,
        master_key: str,
        salt: str = "housler_crypto_v1",
        iterations: int = 100_000,
    ):
        if not master_key:
            raise ValueError("master_key is required")

        try:
            key_bytes = bytes.fromhex(master_key)
            if len(key_bytes) != KEY_LENGTH:
                raise ValueError(f"master_key must be {KEY_LENGTH} bytes (64 hex chars)")
        except ValueError as e:
            raise ValueError(f"Invalid master_key: {e}") from e

        self._master_key = key_bytes
        self._salt = salt.encode("utf-8")
        self._iterations = iterations
        self._key_cache: dict[str, bytes] = {}

    def _derive_key(self, field: str) -> bytes:
        """
        Derive a field-specific key from master key using PBKDF2.

        Each field gets a unique key, improving security isolation.
        """
        if field in self._key_cache:
            return self._key_cache[field]

        # Use field name as part of salt for uniqueness
        field_salt = self._salt + b":" + field.encode("utf-8")

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=KEY_LENGTH,
            salt=field_salt,
            iterations=self._iterations,
        )

        derived_key = kdf.derive(self._master_key)
        self._key_cache[field] = derived_key
        return derived_key

    def encrypt(self, plaintext: str, field: str = "default") -> str:
        """
        Encrypt data using AES-256-GCM.

        Args:
            plaintext: Data to encrypt
            field: Field name for key derivation (e.g., "email", "phone")

        Returns:
            Encrypted string with "hc1:" prefix (base64 encoded)

        Raises:
            ValueError: If plaintext is empty
        """
        if not plaintext:
            return ""

        # Skip if already encrypted
        if plaintext.startswith(ENCRYPTED_PREFIX):
            return plaintext

        key = self._derive_key(field)
        iv = os.urandom(IV_LENGTH)

        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)

        # GCM appends tag to ciphertext, we need to separate
        # ciphertext[-16:] is the tag
        tag = ciphertext[-TAG_LENGTH:]
        encrypted_data = ciphertext[:-TAG_LENGTH]

        # Pack: version (1) + iv (12) + tag (16) + ciphertext
        packed = struct.pack("B", VERSION_GCM) + iv + tag + encrypted_data
        encoded = base64.b64encode(packed).decode("ascii")

        return ENCRYPTED_PREFIX + encoded

    def decrypt(self, ciphertext: str, field: str = "default") -> str:
        """
        Decrypt data encrypted with AES-256-GCM.

        Args:
            ciphertext: Encrypted string (with "hc1:" prefix)
            field: Field name for key derivation

        Returns:
            Decrypted plaintext

        Raises:
            ValueError: If ciphertext is invalid
        """
        if not ciphertext:
            return ""

        # Not encrypted (legacy data)
        if not ciphertext.startswith(ENCRYPTED_PREFIX):
            return ciphertext

        try:
            encoded = ciphertext[len(ENCRYPTED_PREFIX):]
            packed = base64.b64decode(encoded)

            # Minimum size: version (1) + iv (12) + tag (16) + at least 1 byte
            if len(packed) < 1 + IV_LENGTH + TAG_LENGTH + 1:
                raise ValueError("Ciphertext too short")

            # Unpack
            version = packed[0]
            if version != VERSION_GCM:
                raise ValueError(f"Unsupported version: {version}")

            iv = packed[1:1 + IV_LENGTH]
            tag = packed[1 + IV_LENGTH:1 + IV_LENGTH + TAG_LENGTH]
            encrypted_data = packed[1 + IV_LENGTH + TAG_LENGTH:]

            # AESGCM expects tag appended to ciphertext
            combined = encrypted_data + tag

            key = self._derive_key(field)
            aesgcm = AESGCM(key)
            plaintext = aesgcm.decrypt(iv, combined, None)

            return plaintext.decode("utf-8")

        except Exception as e:
            logger.error(f"Decryption failed for field {field}: {e}")
            raise ValueError(f"Decryption failed: {e}") from e

    def blind_index(self, plaintext: str, field: str = "default") -> str:
        """
        Create a blind index (deterministic hash) for searchable encryption.

        Uses BLAKE2b-256 with keyed hashing.
        Same input always produces same output (for searching).

        Args:
            plaintext: Value to hash
            field: Field name for key derivation

        Returns:
            Hex-encoded hash (64 characters)
        """
        if not plaintext:
            return ""

        # Normalize: lowercase and strip
        normalized = plaintext.lower().strip()

        # Derive a separate key for hashing (different from encryption key)
        hash_key = self._derive_key(field + ":blind_index")[:32]

        h = hashlib.blake2b(
            normalized.encode("utf-8"),
            key=hash_key,
            digest_size=32,
        )

        return h.hexdigest()

    def is_encrypted(self, value: str) -> bool:
        """Check if value is encrypted with HouslerCrypto."""
        return bool(value and value.startswith(ENCRYPTED_PREFIX))

    @staticmethod
    def generate_key() -> str:
        """Generate a new 32-byte master key (64 hex chars)."""
        return os.urandom(KEY_LENGTH).hex()
