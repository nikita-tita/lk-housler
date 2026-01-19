"""Comprehensive INN validation service.

This service orchestrates:
1. Checksum validation (local)
2. NPD (self-employed) status check (FNS API)
3. Blacklist check (antifraud)
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_value
from app.integrations.fns.npd_status import NPDStatus, NPDCheckResult, check_npd_status
from app.models.antifraud import BlacklistType
from app.utils.inn_validator import (
    validate_inn_checksum,
    get_inn_type,
    is_self_employed_inn,
)


logger = logging.getLogger(__name__)


class INNValidationLevel(str, Enum):
    """Validation level"""
    CHECKSUM_ONLY = "checksum_only"  # Just validate checksum
    BASIC = "basic"  # Checksum + blacklist
    FULL = "full"  # Checksum + blacklist + NPD status


class INNValidationStatus(str, Enum):
    """Overall validation status"""
    VALID = "valid"  # All checks passed
    INVALID_FORMAT = "invalid_format"  # Invalid checksum or format
    BLACKLISTED = "blacklisted"  # INN is in blacklist
    NPD_NOT_REGISTERED = "npd_not_registered"  # Not registered as self-employed
    NPD_CHECK_FAILED = "npd_check_failed"  # Could not verify NPD status
    ERROR = "error"  # Internal error


@dataclass
class INNValidationResult:
    """Result of INN validation"""
    inn: str
    status: INNValidationStatus = INNValidationStatus.ERROR  # Default to error until validated
    inn_type: Optional[str] = None  # 'individual' or 'legal_entity'
    is_valid: bool = False

    # Check results
    checksum_valid: bool = False
    is_blacklisted: bool = False
    npd_status: Optional[NPDStatus] = None
    npd_registration_date: Optional[datetime] = None

    # Errors and warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Metadata
    checked_at: datetime = field(default_factory=datetime.utcnow)


class INNValidationService:
    """
    Comprehensive INN validation service.

    Usage:
        service = INNValidationService(db)
        result = await service.validate("123456789012", level=INNValidationLevel.FULL)

        if result.is_valid:
            # INN is valid
        else:
            # Handle validation errors
            print(result.errors)
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def validate(
        self,
        inn: str,
        level: INNValidationLevel = INNValidationLevel.FULL,
        require_self_employed: bool = False,
    ) -> INNValidationResult:
        """
        Validate INN with specified level of checks.

        Args:
            inn: The INN to validate
            level: Validation level (checksum_only, basic, full)
            require_self_employed: If True, require NPD registration for individuals

        Returns:
            INNValidationResult with detailed validation information
        """
        # Initialize result
        result = INNValidationResult(inn=inn.strip() if inn else "")

        if not inn:
            result.status = INNValidationStatus.INVALID_FORMAT
            result.errors.append("INN is required")
            return result

        inn = inn.strip()

        # Step 1: Checksum validation
        checksum_valid, checksum_error = validate_inn_checksum(inn)
        result.checksum_valid = checksum_valid

        if not checksum_valid:
            result.status = INNValidationStatus.INVALID_FORMAT
            result.errors.append(checksum_error or "Invalid INN checksum")
            return result

        # Determine INN type
        result.inn_type = get_inn_type(inn)

        # If only checksum validation requested, we're done
        if level == INNValidationLevel.CHECKSUM_ONLY:
            result.status = INNValidationStatus.VALID
            result.is_valid = True
            return result

        # Step 2: Blacklist check
        is_blacklisted = await self._check_blacklist(inn)
        result.is_blacklisted = is_blacklisted

        if is_blacklisted:
            result.status = INNValidationStatus.BLACKLISTED
            result.errors.append("INN is in blacklist")
            logger.warning(f"Blacklisted INN attempted: {inn[:4]}****")
            return result

        # If basic validation, we're done
        if level == INNValidationLevel.BASIC:
            result.status = INNValidationStatus.VALID
            result.is_valid = True
            return result

        # Step 3: NPD status check (only for individual INNs)
        if result.inn_type == 'individual':
            npd_result = await self._check_npd_status(inn)
            result.npd_status = npd_result.status
            result.npd_registration_date = npd_result.registration_date

            # Check if NPD status verification failed
            if npd_result.status == NPDStatus.ERROR:
                # NPD check failed - add warning but don't block
                result.warnings.append(
                    f"Could not verify self-employed status: {npd_result.error_message}"
                )
                if require_self_employed:
                    result.status = INNValidationStatus.NPD_CHECK_FAILED
                    result.errors.append("Could not verify self-employed status")
                    return result

            # Check if self-employed status is required
            elif npd_result.status != NPDStatus.REGISTERED:
                if require_self_employed:
                    result.status = INNValidationStatus.NPD_NOT_REGISTERED
                    result.errors.append(
                        "Taxpayer is not registered as self-employed (NPD)"
                    )
                    return result
                else:
                    result.warnings.append(
                        "Taxpayer is not registered as self-employed (NPD)"
                    )

        elif result.inn_type == 'legal_entity' and require_self_employed:
            # Legal entity INN but self-employed required
            result.status = INNValidationStatus.INVALID_FORMAT
            result.errors.append(
                "Self-employed taxpayer requires individual INN (12 digits)"
            )
            return result

        # All checks passed
        result.status = INNValidationStatus.VALID
        result.is_valid = True
        return result

    async def validate_recipient_inn(
        self,
        inn: str,
        role: str,
    ) -> INNValidationResult:
        """
        Validate INN for a split recipient.

        Different roles have different requirements:
        - agent: Individual INN, preferably self-employed
        - agency: Legal entity INN
        - client: Either type

        Args:
            inn: The INN to validate
            role: Recipient role (agent, agency, client, etc.)

        Returns:
            INNValidationResult
        """
        # Determine validation requirements based on role
        if role == "agent":
            # Agents should be self-employed individuals
            return await self.validate(
                inn,
                level=INNValidationLevel.FULL,
                require_self_employed=settings.REQUIRE_AGENT_NPD_STATUS,
            )

        elif role == "agency":
            # Agencies are legal entities
            result = await self.validate(inn, level=INNValidationLevel.BASIC)

            if result.is_valid and result.inn_type != 'legal_entity':
                result.is_valid = False
                result.status = INNValidationStatus.INVALID_FORMAT
                result.errors.append("Agency requires legal entity INN (10 digits)")

            return result

        else:
            # Other roles: basic validation
            return await self.validate(inn, level=INNValidationLevel.BASIC)

    async def _check_blacklist(self, inn: str) -> bool:
        """Check if INN is in blacklist"""
        from sqlalchemy import select
        from app.models.antifraud import Blacklist

        inn_hash = hash_value(inn)

        stmt = select(Blacklist).where(
            Blacklist.type == BlacklistType.INN,
            Blacklist.value_hash == inn_hash
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def _check_npd_status(self, inn: str) -> NPDCheckResult:
        """Check NPD (self-employed) status via FNS API"""
        return await check_npd_status(inn)


# Convenience function for quick validation
async def validate_inn_full(
    db: AsyncSession,
    inn: str,
    require_self_employed: bool = False,
) -> INNValidationResult:
    """
    Convenience function for full INN validation.

    Args:
        db: Database session
        inn: INN to validate
        require_self_employed: If True, require NPD registration

    Returns:
        INNValidationResult
    """
    service = INNValidationService(db)
    return await service.validate(
        inn,
        level=INNValidationLevel.FULL,
        require_self_employed=require_self_employed,
    )
