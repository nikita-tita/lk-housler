"""
Migration utilities for converting from legacy encryption formats.

Supports:
- Fernet (used by lk and club projects)
- Raw AES-GCM (used by agent/housler_pervichka)
"""

from __future__ import annotations

import base64
import logging

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .core import HouslerCrypto

logger = logging.getLogger(__name__)


class FernetMigrator:
    """
    Migrate data from Fernet encryption to HouslerCrypto.

    This handles the two Fernet implementations:
    1. lk: Single key derived from ENCRYPTION_KEY + ENCRYPTION_SALT
    2. club: Per-field keys derived from ENCRYPTION_MASTER_KEY

    Usage:
        # For lk project
        migrator = FernetMigrator.from_lk_config(
            encryption_key="<hex>",
            encryption_salt="<salt>"
        )

        # For club project
        migrator = FernetMigrator.from_club_config(
            master_key="<hex>"
        )

        # Migrate single value
        new_encrypted = migrator.migrate(
            old_encrypted,
            field="email",
            new_crypto=housler_crypto_instance
        )

        # Or just decrypt old data
        plaintext = migrator.decrypt(old_encrypted, field="email")
    """

    def __init__(self):
        self._fernet_cache: dict[str, Fernet] = {}
        self._single_fernet: Fernet | None = None
        self._master_key: bytes | None = None
        self._salt: bytes = b""

    @classmethod
    def from_lk_config(
        cls,
        encryption_key: str,
        encryption_salt: str,
        iterations: int = 100_000,
    ) -> FernetMigrator:
        """
        Create migrator for lk project's Fernet encryption.

        lk uses a single Fernet key derived from ENCRYPTION_KEY + ENCRYPTION_SALT.
        """
        instance = cls()

        key_bytes = bytes.fromhex(encryption_key)
        salt = encryption_salt.encode("utf-8")

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=iterations,
        )

        fernet_key = base64.urlsafe_b64encode(kdf.derive(key_bytes))
        instance._single_fernet = Fernet(fernet_key)

        return instance

    @classmethod
    def from_club_config(
        cls,
        master_key: str,
        salt: str = "vas3k_club_pii_salt_v1",
        iterations: int = 100_000,
    ) -> FernetMigrator:
        """
        Create migrator for club project's Fernet encryption.

        club uses per-field Fernet keys derived from ENCRYPTION_MASTER_KEY.
        """
        instance = cls()
        instance._master_key = bytes.fromhex(master_key)
        instance._salt = salt.encode("utf-8")
        instance._iterations = iterations
        return instance

    @classmethod
    def from_agent_config(cls, encryption_key: str) -> FernetMigrator:
        """
        Create migrator for agent (housler_pervichka) AES-GCM encryption.

        Note: agent uses AES-256-GCM directly (not Fernet), so we need
        to handle its format: base64(IV + AuthTag + Ciphertext)
        """
        instance = cls()
        instance._agent_key = bytes.fromhex(encryption_key)
        instance._is_agent = True
        return instance

    def _get_fernet_for_field(self, field: str) -> Fernet | None:
        """Get Fernet instance for a field (club-style per-field keys)."""
        if self._single_fernet:
            return self._single_fernet

        if not self._master_key:
            return None

        if field in self._fernet_cache:
            return self._fernet_cache[field]

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self._salt + field.encode("utf-8"),
            iterations=getattr(self, "_iterations", 100_000),
        )

        fernet_key = base64.urlsafe_b64encode(kdf.derive(self._master_key))
        fernet = Fernet(fernet_key)
        self._fernet_cache[field] = fernet
        return fernet

    def decrypt(self, ciphertext: str, field: str = "default") -> str:
        """
        Decrypt data from legacy format.

        Handles:
        - Fernet tokens (lk and club)
        - "enc:" prefixed (club)
        - agent's AES-GCM format
        """
        if not ciphertext:
            return ""

        # Club's "enc:" prefix
        if ciphertext.startswith("enc:"):
            ciphertext = ciphertext[4:]
            try:
                ciphertext = base64.urlsafe_b64decode(ciphertext).decode("utf-8")
            except Exception:
                pass

        # Try agent AES-GCM format
        if hasattr(self, "_is_agent") and self._is_agent:
            return self._decrypt_agent_gcm(ciphertext)

        # Try Fernet
        fernet = self._get_fernet_for_field(field)
        if not fernet:
            raise ValueError("Migrator not configured")

        try:
            plaintext = fernet.decrypt(ciphertext.encode("utf-8"))
            return plaintext.decode("utf-8")
        except InvalidToken:
            logger.warning(f"Failed to decrypt field {field} - may be plaintext")
            return ciphertext

    def _decrypt_agent_gcm(self, ciphertext: str) -> str:
        """Decrypt agent's AES-256-GCM format."""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        if not hasattr(self, "_agent_key"):
            raise ValueError("Agent key not configured")

        try:
            data = base64.b64decode(ciphertext)

            # Format: IV (16) + AuthTag (16) + Ciphertext
            iv_length = 16
            tag_length = 16

            if len(data) < iv_length + tag_length + 1:
                raise ValueError("Ciphertext too short")

            iv = data[:iv_length]
            tag = data[iv_length:iv_length + tag_length]
            encrypted = data[iv_length + tag_length:]

            # AESGCM expects tag appended
            combined = encrypted + tag

            aesgcm = AESGCM(self._agent_key)
            plaintext = aesgcm.decrypt(iv, combined, None)
            return plaintext.decode("utf-8")

        except Exception as e:
            logger.error(f"Agent GCM decryption failed: {e}")
            raise ValueError(f"Decryption failed: {e}") from e

    def migrate(
        self,
        old_ciphertext: str,
        field: str,
        new_crypto: HouslerCrypto,
    ) -> str:
        """
        Migrate encrypted data from legacy format to HouslerCrypto.

        Args:
            old_ciphertext: Data encrypted with legacy method
            field: Field name (for per-field key derivation)
            new_crypto: HouslerCrypto instance for re-encryption

        Returns:
            Data encrypted with HouslerCrypto
        """
        if not old_ciphertext:
            return ""

        # Already migrated?
        if old_ciphertext.startswith("hc1:"):
            return old_ciphertext

        # Decrypt with old method
        plaintext = self.decrypt(old_ciphertext, field)

        # Re-encrypt with new method
        return new_crypto.encrypt(plaintext, field)


def migrate_database_field(
    db_connection,
    table: str,
    pk_column: str,
    encrypted_column: str,
    field: str,
    migrator: FernetMigrator,
    new_crypto: HouslerCrypto,
    batch_size: int = 1000,
    dry_run: bool = True,
) -> dict:
    """
    Migrate a database column from legacy encryption to HouslerCrypto.

    WARNING: Always run with dry_run=True first!

    Args:
        db_connection: Database connection (supports execute/fetchall)
        table: Table name
        pk_column: Primary key column name
        encrypted_column: Column with encrypted data
        field: Field name for HouslerCrypto
        migrator: FernetMigrator instance
        new_crypto: HouslerCrypto instance
        batch_size: Number of rows per batch
        dry_run: If True, don't actually update

    Returns:
        Dict with migration stats
    """
    stats = {
        "total": 0,
        "migrated": 0,
        "skipped": 0,
        "errors": 0,
        "dry_run": dry_run,
    }

    cursor = db_connection.cursor()

    # Count total
    cursor.execute(f"SELECT COUNT(*) FROM {table} WHERE {encrypted_column} IS NOT NULL")
    stats["total"] = cursor.fetchone()[0]

    # Process in batches
    offset = 0
    while True:
        cursor.execute(
            f"SELECT {pk_column}, {encrypted_column} FROM {table} "
            f"WHERE {encrypted_column} IS NOT NULL "
            f"LIMIT {batch_size} OFFSET {offset}"
        )
        rows = cursor.fetchall()

        if not rows:
            break

        for pk, old_value in rows:
            try:
                # Skip already migrated
                if old_value.startswith("hc1:"):
                    stats["skipped"] += 1
                    continue

                new_value = migrator.migrate(old_value, field, new_crypto)

                if not dry_run:
                    cursor.execute(
                        f"UPDATE {table} SET {encrypted_column} = %s WHERE {pk_column} = %s",
                        (new_value, pk)
                    )

                stats["migrated"] += 1

            except Exception as e:
                logger.error(f"Failed to migrate {table}.{pk_column}={pk}: {e}")
                stats["errors"] += 1

        offset += batch_size

        if not dry_run:
            db_connection.commit()

    return stats
