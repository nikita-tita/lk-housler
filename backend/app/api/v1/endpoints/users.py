"""User endpoints"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


class UserSearchResult(BaseModel):
    """User search result - minimal info for partner selection"""
    id: int
    name: Optional[str] = None
    phone_masked: Optional[str] = None
    role: str
    is_registered: bool = True

    class Config:
        from_attributes = True


class UserSearchResponse(BaseModel):
    """Search response"""
    found: bool
    user: Optional[UserSearchResult] = None


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """Mask phone for privacy: +7 (911) ***-**-20"""
    if not phone:
        return None
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) < 10:
        return None
    # Format: +7 (XXX) ***-**-XX
    return f"+7 ({digits[1:4]}) ***-**-{digits[-2:]}"


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user info with organization details"""
    from sqlalchemy import text
    from app.models.organization import Organization, OrganizationMember
    from app.schemas.user import UserResponse, AgencyInfo

    # Build response with user data
    response_data = {
        "id": current_user.id,
        "email": current_user.email,
        "phone": current_user.phone,
        "name": current_user.name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "agency_id": current_user.agency_id,
        "city": current_user.city,
        "is_self_employed": current_user.is_self_employed,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }

    agency_info = None

    # First, try to find organization membership (lk.housler.ru pattern)
    stmt = (
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    org = result.scalar_one_or_none()

    if org:
        agency_info = AgencyInfo(
            id=str(org.id),
            legal_name=org.legal_name,
            short_name=org.legal_name[:30] if len(org.legal_name) > 30 else None,
        )
    elif current_user.agency_id:
        # Fallback: check agencies table (agent.housler.ru pattern)
        try:
            stmt = text("SELECT id, name FROM agencies WHERE id = :agency_id")
            result = await db.execute(stmt, {"agency_id": current_user.agency_id})
            agency_row = result.fetchone()
            if agency_row:
                agency_info = AgencyInfo(
                    id=str(agency_row[0]),
                    legal_name=agency_row[1] or "Агентство",
                    short_name=None,
                )
        except Exception:
            # agencies table might not exist - ignore
            pass

    if agency_info:
        response_data["agency"] = agency_info

    return UserResponse(**response_data)


@router.get("/search", response_model=UserSearchResponse)
async def search_user_by_phone(
    phone: str = Query(..., min_length=10, max_length=20, description="Phone number to search"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for existing user by phone number.
    Used when adding co-agent to deal - checks if user already registered.
    Returns minimal info (masked phone) for privacy.
    """
    # Normalize phone: remove all non-digits, ensure starts with 7
    digits = ''.join(filter(str.isdigit, phone))
    if len(digits) == 11 and digits.startswith('8'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits

    # Search by normalized phone (phone column stores: 79110295520 format)
    stmt = select(User).where(
        or_(
            User.phone == digits,
            User.phone == f"+{digits}",
            User.phone == f"+7{digits[1:]}" if len(digits) == 11 else False,
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        return UserSearchResponse(found=False)

    # Don't return self
    if user.id == current_user.id:
        return UserSearchResponse(found=False)

    return UserSearchResponse(
        found=True,
        user=UserSearchResult(
            id=user.id,
            name=user.name,
            phone_masked=mask_phone(user.phone),
            role=user.role or "agent",
            is_registered=True,
        )
    )


# Note: User profile management is handled by agent.housler.ru
# lk.housler.ru only reads user data from the shared database
