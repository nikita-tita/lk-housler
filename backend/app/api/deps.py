"""API dependencies"""

from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User
from app.models.deal import Deal
from app.models.organization import OrganizationMember
from app.services.user.service import UserService

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current authenticated user"""
    token = credentials.credentials

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user_service = UserService(db)
    user = await user_service.get_by_id(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    if not credentials:
        return None

    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def check_deal_access(deal: Deal, user: User) -> bool:
    """Check if user has access to deal (creator or agent)"""
    return deal.created_by_user_id == user.id or deal.agent_user_id == user.id


def require_deal_access(deal: Deal, user: User) -> None:
    """Raise 403 if user has no access to deal"""
    if not check_deal_access(deal, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this deal")


def require_deal_owner(deal: Deal, user: User) -> None:
    """Raise 403 if user is not deal creator"""
    if deal.created_by_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can perform this action")


async def check_org_membership(org_id: UUID, user: User, db: AsyncSession) -> Optional[OrganizationMember]:
    """Check if user is member of organization, return membership"""
    stmt = select(OrganizationMember).where(
        OrganizationMember.org_id == org_id,
        OrganizationMember.user_id == user.id,
        OrganizationMember.is_active == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def require_org_membership(org_id: UUID, user: User, db: AsyncSession) -> OrganizationMember:
    """Raise 403 if user is not member of organization"""
    member = await check_org_membership(org_id, user, db)
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this organization")
    return member


async def require_org_admin(org_id: UUID, user: User, db: AsyncSession) -> OrganizationMember:
    """Raise 403 if user is not admin of organization"""
    member = await require_org_membership(org_id, user, db)
    if member.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for this action")
    return member


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Raise 403 if user is not platform admin"""
    if current_user.role not in ("admin", "operator"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required for this action")
    return current_user
