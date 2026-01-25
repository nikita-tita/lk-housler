#!/usr/bin/env python3
"""
Migrate Legacy Fernet encryption to HouslerCrypto

This script migrates encrypted PII fields from legacy Fernet format to
HouslerCrypto (AES-256-GCM). Run this once if you have data encrypted
with old Fernet keys.

Requirements:
- Set ENCRYPTION_KEY (old Fernet key as hex)
- Set ENCRYPTION_SALT (old Fernet salt)
- Set HOUSLER_CRYPTO_KEY (new HouslerCrypto key)

Usage:
    # Dry run (check what would be migrated):
    python scripts/migrate_fernet_to_housler_crypto.py --dry-run

    # Actual migration:
    python scripts/migrate_fernet_to_housler_crypto.py --execute

    # Migrate specific table:
    python scripts/migrate_fernet_to_housler_crypto.py --table lk_deals --execute
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from housler_crypto import HouslerCrypto, FernetMigrator
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Tables and columns to migrate
MIGRATION_TARGETS = [
    # (table, pk_column, encrypted_column, field_for_crypto)
    ("users", "id", "name_encrypted", "name"),
    ("users", "id", "phone_encrypted", "phone"),
    ("users", "id", "email_encrypted", "email"),
    ("users", "id", "personal_inn_encrypted", "inn"),
    ("lk_deals", "id", "client_name_encrypted", "name"),
    ("lk_deals", "id", "client_phone_encrypted", "phone"),
    ("lk_deals", "id", "client_passport_series_encrypted", "passport_series"),
    ("lk_deals", "id", "client_passport_number_encrypted", "passport_number"),
    ("lk_deals", "id", "client_passport_issued_by_encrypted", "passport_issued_by"),
    ("lk_deals", "id", "client_birth_place_encrypted", "name"),
    ("lk_deals", "id", "client_registration_address_encrypted", "name"),
    ("payment_profiles", "id", "inn_encrypted", "inn"),
    ("payment_profiles", "id", "kpp_encrypted", "inn"),
    ("payment_profiles", "id", "bank_account_encrypted", "bank_account"),
]


def is_housler_crypto_format(value: str) -> bool:
    """Check if value is already in HouslerCrypto format (hc1: prefix)"""
    return value.startswith("hc1:")


def is_fernet_format(value: str) -> bool:
    """
    Check if value looks like Fernet format.
    Fernet tokens are base64-encoded and start with gAAA (version byte 0x80).
    """
    if not value:
        return False
    if value.startswith("hc1:"):
        return False
    # Fernet tokens are typically 100+ chars and base64
    return len(value) > 50 and value[0] == "g"


async def check_legacy_data(session: AsyncSession, table: str, column: str, pk_column: str) -> dict:
    """Check for legacy Fernet data in a column"""
    stats = {
        "table": table,
        "column": column,
        "total": 0,
        "null_or_empty": 0,
        "housler_crypto": 0,
        "legacy_fernet": 0,
        "unknown": 0,
    }

    # Check if table/column exists
    try:
        result = await session.execute(
            text(f"SELECT {pk_column}, {column} FROM {table} WHERE {column} IS NOT NULL AND {column} != ''")
        )
        rows = result.fetchall()
    except Exception as e:
        logger.warning(f"Table {table}.{column} not found or error: {e}")
        return stats

    for pk, value in rows:
        stats["total"] += 1
        if not value:
            stats["null_or_empty"] += 1
        elif is_housler_crypto_format(value):
            stats["housler_crypto"] += 1
        elif is_fernet_format(value):
            stats["legacy_fernet"] += 1
        else:
            stats["unknown"] += 1

    return stats


async def migrate_column(
    session: AsyncSession,
    table: str,
    pk_column: str,
    column: str,
    field: str,
    migrator: FernetMigrator,
    new_crypto: HouslerCrypto,
    dry_run: bool = True,
) -> dict:
    """Migrate a single column from Fernet to HouslerCrypto"""
    stats = {
        "table": table,
        "column": column,
        "migrated": 0,
        "skipped": 0,
        "errors": 0,
    }

    try:
        result = await session.execute(
            text(f"SELECT {pk_column}, {column} FROM {table} WHERE {column} IS NOT NULL AND {column} != ''")
        )
        rows = result.fetchall()
    except Exception as e:
        logger.error(f"Error reading {table}.{column}: {e}")
        stats["errors"] += 1
        return stats

    for pk, old_value in rows:
        if is_housler_crypto_format(old_value):
            stats["skipped"] += 1
            continue

        if not is_fernet_format(old_value):
            logger.debug(f"Skipping non-Fernet value in {table}.{pk_column}={pk}")
            stats["skipped"] += 1
            continue

        try:
            # Migrate: decrypt with Fernet, encrypt with HouslerCrypto
            new_value = migrator.migrate(old_value, field, new_crypto)

            if not dry_run:
                await session.execute(
                    text(f"UPDATE {table} SET {column} = :new_value WHERE {pk_column} = :pk"),
                    {"new_value": new_value, "pk": pk},
                )

            stats["migrated"] += 1
            logger.info(f"{'[DRY-RUN] ' if dry_run else ''}Migrated {table}.{pk_column}={pk}.{column}")

        except Exception as e:
            logger.error(f"Failed to migrate {table}.{pk_column}={pk}.{column}: {e}")
            stats["errors"] += 1

    return stats


async def main(dry_run: bool = True, tables: list = None):
    """Main migration function"""
    # Validate configuration
    if not settings.HOUSLER_CRYPTO_KEY:
        logger.error("HOUSLER_CRYPTO_KEY not set!")
        sys.exit(1)

    # Check for legacy keys
    has_legacy_keys = bool(settings.ENCRYPTION_KEY and settings.ENCRYPTION_SALT)

    logger.info("=" * 60)
    logger.info("Fernet to HouslerCrypto Migration")
    logger.info("=" * 60)
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    logger.info(f"Legacy keys configured: {has_legacy_keys}")
    logger.info("")

    # Create database connection
    engine = create_async_engine(settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"))
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create crypto instances
    new_crypto = HouslerCrypto(master_key=settings.HOUSLER_CRYPTO_KEY)

    migrator = None
    if has_legacy_keys:
        migrator = FernetMigrator.from_lk_config(
            encryption_key=settings.ENCRYPTION_KEY,
            encryption_salt=settings.ENCRYPTION_SALT,
        )

    async with async_session() as session:
        # Phase 1: Check all columns for legacy data
        logger.info("Phase 1: Checking for legacy Fernet data...")
        logger.info("-" * 60)

        total_legacy = 0
        targets_to_migrate = []

        for table, pk_column, column, field in MIGRATION_TARGETS:
            if tables and table not in tables:
                continue

            stats = await check_legacy_data(session, table, column, pk_column)

            if stats["total"] > 0:
                logger.info(
                    f"{table}.{column}: "
                    f"total={stats['total']}, "
                    f"housler_crypto={stats['housler_crypto']}, "
                    f"legacy={stats['legacy_fernet']}, "
                    f"unknown={stats['unknown']}"
                )

                if stats["legacy_fernet"] > 0:
                    total_legacy += stats["legacy_fernet"]
                    targets_to_migrate.append((table, pk_column, column, field))

        logger.info("")
        logger.info(f"Total legacy Fernet values found: {total_legacy}")
        logger.info("")

        if total_legacy == 0:
            logger.info("No legacy Fernet data found. Migration not needed.")
            return

        if not has_legacy_keys:
            logger.error("Legacy Fernet data found but ENCRYPTION_KEY/ENCRYPTION_SALT not set!")
            logger.error("Set these environment variables to migrate the data.")
            sys.exit(1)

        # Phase 2: Migrate
        logger.info("Phase 2: Migrating data...")
        logger.info("-" * 60)

        total_migrated = 0
        total_errors = 0

        for table, pk_column, column, field in targets_to_migrate:
            stats = await migrate_column(
                session, table, pk_column, column, field,
                migrator, new_crypto, dry_run=dry_run
            )
            total_migrated += stats["migrated"]
            total_errors += stats["errors"]

        if not dry_run:
            await session.commit()

        logger.info("")
        logger.info("=" * 60)
        logger.info(f"Migration {'would migrate' if dry_run else 'completed'}:")
        logger.info(f"  Migrated: {total_migrated}")
        logger.info(f"  Errors: {total_errors}")
        logger.info("=" * 60)

        if dry_run and total_migrated > 0:
            logger.info("")
            logger.info("Run with --execute to perform actual migration.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate Fernet encryption to HouslerCrypto")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Check without modifying data (default)")
    parser.add_argument("--execute", action="store_true", help="Actually perform migration")
    parser.add_argument("--table", type=str, help="Migrate specific table only")

    args = parser.parse_args()

    dry_run = not args.execute
    tables = [args.table] if args.table else None

    asyncio.run(main(dry_run=dry_run, tables=tables))
