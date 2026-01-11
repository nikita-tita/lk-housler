"""Organization endpoints"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_org_membership, require_org_admin
from app.db.session import get_db
from app.models.user import User
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


@router.get("", response_model=List[OrganizationSchema])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's organizations"""
    org_service = OrganizationService(db)
    organizations = await org_service.list_user_organizations(current_user)
    return organizations


@router.post("", response_model=OrganizationSchema, status_code=status.HTTP_201_CREATED)
async def create_organization(
    org_in: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create new organization"""
    org_service = OrganizationService(db)

    try:
        organization = await org_service.create(org_in, current_user)
        return organization
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{org_id}", response_model=OrganizationSchema)
async def get_organization(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get organization by ID"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    await require_org_membership(organization.id, current_user, db)

    return organization


@router.put("/{org_id}", response_model=OrganizationSchema)
async def update_organization(
    org_id: str,
    org_in: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    await require_org_admin(organization.id, current_user, db)

    organization = await org_service.update(organization, org_in)
    return organization


@router.post("/{org_id}/members", response_model=OrganizationMemberSchema)
async def add_member(
    org_id: str,
    member_in: OrganizationMemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add member to organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    await require_org_admin(organization.id, current_user, db)

    try:
        member = await org_service.add_member(organization, member_in)
        return member
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{org_id}/payout-accounts", response_model=PayoutAccountSchema)
async def create_payout_account(
    org_id: str,
    account_in: PayoutAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create payout account for organization"""
    org_service = OrganizationService(db)
    organization = await org_service.get_by_id(org_id)

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    await require_org_admin(organization.id, current_user, db)

    account = await org_service.create_payout_account("org", org_id, account_in)
    return account
