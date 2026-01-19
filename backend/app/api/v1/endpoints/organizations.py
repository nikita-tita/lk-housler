"""Organization endpoints"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_org_membership, require_org_admin
from app.db.session import get_db
from app.models.user import User
from app.models.organization import OrganizationMember, MemberRole
from app.schemas.organization import (
    Organization as OrganizationSchema,
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationMember as OrganizationMemberSchema,
    OrganizationMemberCreate,
    PayoutAccount as PayoutAccountSchema,
    PayoutAccountCreate,
)
from app.services.organization.service import OrganizationService

router = APIRouter()


class AddAgentByPhoneRequest(BaseModel):
    """Request to add agent by phone"""
    phone: str
    role: str = "agent"


class AgentInfo(BaseModel):
    """Agent info for list"""
    id: int
    user_id: int
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    """Response for agent list"""
    items: List[AgentInfo]
    total: int


@router.get("", response_model=List[OrganizationSchema])
async def list_organizations(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List user's organizations"""
    org_service = OrganizationService(db)
    organizations = await org_service.list_user_organizations(current_user)
    return organizations


@router.post("", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Create new organization"""
    org_service = OrganizationService(db)

    try:
        organization = await org_service.create(org_in, current_user)
        return organization
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{org_id}", response_model=OrganizationSchema)
async def get_organization(
    org_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get organization by ID"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_membership(organization.id, current_user, db)

    return organization


@router.put("/{org_id}", response_model=OrganizationSchema)
async def update_organization(
    org_id: str,
    org_in: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_admin(organization.id, current_user, db)

    organization = await org_service.update(organization, org_in)
    return organization


@router.post("/{org_id}/members", response_model=OrganizationMemberSchema)
async def add_member(
    org_id: str,
    member_in: OrganizationMemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add member to organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_admin(organization.id, current_user, db)

    try:
        member = await org_service.add_member(organization, member_in)
        return member
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{org_id}/payout-accounts", response_model=PayoutAccountSchema)
async def create_payout_account(
    org_id: str,
    account_in: PayoutAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create payout account for organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_admin(organization.id, current_user, db)

    account = await org_service.create_payout_account("org", org_id, account_in)
    return account


@router.get("/{org_id}/agents", response_model=AgentListResponse)
async def list_agents(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agents in organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_membership(organization.id, current_user, db)

    # Get all members with user info
    stmt = (
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.org_id == organization.id)
    )
    result = await db.execute(stmt)
    members_with_users = result.all()

    items = []
    for member, user in members_with_users:
        items.append(AgentInfo(
            id=member.id,
            user_id=user.id,
            name=user.name,
            phone=user.phone,
            email=user.email,
            role=member.role.value if hasattr(member.role, 'value') else member.role,
            is_active=member.is_active,
        ))

    return AgentListResponse(items=items, total=len(items))


@router.post("/{org_id}/agents", response_model=AgentInfo)
async def add_agent_by_phone(
    org_id: str,
    request: AddAgentByPhoneRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add agent to organization by phone number"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_admin(organization.id, current_user, db)

    # Normalize phone
    digits = ''.join(filter(str.isdigit, request.phone))
    if len(digits) == 11 and digits.startswith('8'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits

    # Find user by phone
    stmt = select(User).where(
        or_(
            User.phone == digits,
            User.phone == f"+{digits}",
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь с таким телефоном не найден. Агент должен сначала зарегистрироваться."
        )

    # Add as member
    try:
        member = await org_service.add_member(
            organization,
            OrganizationMemberCreate(user_id=user.id, role=request.role)
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return AgentInfo(
        id=member.id,
        user_id=user.id,
        name=user.name,
        phone=user.phone,
        email=user.email,
        role=member.role.value if hasattr(member.role, 'value') else member.role,
        is_active=member.is_active,
    )


@router.delete("/{org_id}/agents/{user_id}")
async def remove_agent(
    org_id: str,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove agent from organization (deactivate)"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    await require_org_admin(organization.id, current_user, db)

    # Find member
    stmt = select(OrganizationMember).where(
        OrganizationMember.org_id == organization.id,
        OrganizationMember.user_id == user_id,
    )
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()

    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Cannot remove self
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить себя")

    # Deactivate
    member.is_active = False
    await db.commit()

    return {"success": True, "message": "Агент удалён из организации"}
