"""Agency endpoints"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.deal import DealStatus
from app.models.organization import OrganizationMember, MemberRole
from app.schemas.deal import DealSimpleResponse, DealListSimple
from app.services.deal.service import DealService

logger = logging.getLogger(__name__)
router = APIRouter()


async def get_user_organization(user: User, db: AsyncSession) -> Optional[UUID]:
    """Get organization ID for user if they are admin"""
    stmt = select(OrganizationMember).where(
        OrganizationMember.user_id == user.id,
        OrganizationMember.is_active == True,
        OrganizationMember.role == MemberRole.ADMIN
    )
    result = await db.execute(stmt)
    membership = result.scalar_one_or_none()
    return membership.org_id if membership else None


@router.get("/deals", response_model=DealListSimple)
async def list_agency_deals(
    status: Optional[DealStatus] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all deals from agents in user's organization.
    Only available for organization admins.
    """
    org_id = await get_user_organization(current_user, db)

    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agency admins can view all agency deals"
        )

    deal_service = DealService(db)
    deals, total = await deal_service.list_organization_deals(
        org_id=org_id,
        status=status,
        page=page,
        page_size=size
    )

    items = []
    for deal in deals:
        items.append(
            DealSimpleResponse(
                id=deal.id,
                type=deal.type,
                status=deal.status,
                address=deal.property_address or "",
                price=int(deal.price or 0),
                commission_agent=int(deal.commission_agent or 0),
                client_name=deal.client_name,
                agent_user_id=deal.agent_user_id,
                created_at=deal.created_at,
                updated_at=deal.updated_at,
            )
        )

    return DealListSimple(items=items, total=total, page=page, size=size)


@router.get("/agents")
async def list_agency_agents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all agents in user's organization.
    Only available for organization admins.
    """
    org_id = await get_user_organization(current_user, db)

    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only agency admins can view agents"
        )

    # Get all members
    stmt = select(OrganizationMember).where(
        OrganizationMember.org_id == org_id,
        OrganizationMember.is_active == True
    )
    result = await db.execute(stmt)
    members = result.scalars().all()

    agents = []
    for member in members:
        # Load user data
        user_stmt = select(User).where(User.id == member.user_id)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()

        if user:
            agents.append({
                "id": user.id,
                "name": user.name,
                "phone": user.phone,
                "role": member.role.value,
                "is_active": member.is_active,
            })

    return {"agents": agents, "total": len(agents)}
