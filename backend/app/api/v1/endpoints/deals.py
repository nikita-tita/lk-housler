"""Deal endpoints"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_deal_access, require_deal_owner
from app.db.session import get_db
from app.models.user import User
from app.models.deal import DealStatus
from app.schemas.deal import (
    Deal as DealSchema,
    DealCreate,
    DealUpdate,
    DealList,
    DealCreateSimple,
    DealSimpleResponse,
    DealListSimple,
)
from app.services.deal.service import DealService

router = APIRouter()


@router.get("/", response_model=DealListSimple)
async def list_deals(
    status: Optional[DealStatus] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's deals"""
    deal_service = DealService(db)
    deals, total = await deal_service.list_deals(
        current_user,
        status=status,
        page=page,
        page_size=size
    )

    # Convert to simplified response
    items = []
    for deal in deals:
        items.append(DealSimpleResponse(
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
        ))

    return DealListSimple(
        items=items,
        total=total,
        page=page,
        size=size
    )


@router.post("/", response_model=DealSimpleResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_in: DealCreateSimple,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create new deal (simplified)"""
    deal_service = DealService(db)

    try:
        deal = await deal_service.create_simple(deal_in, current_user)
        await db.commit()

        return DealSimpleResponse(
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
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{deal_id}", response_model=DealSchema)
async def get_deal(
    deal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get deal by ID"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)
    
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    require_deal_access(deal, current_user)

    return deal


@router.put("/{deal_id}", response_model=DealSchema)
async def update_deal(
    deal_id: str,
    deal_in: DealUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)
    
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    require_deal_access(deal, current_user)

    try:
        deal = await deal_service.update(deal, deal_in)
        return deal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{deal_id}/submit", response_model=DealSchema)
async def submit_deal(
    deal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit deal for signatures"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)
    
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    require_deal_owner(deal, current_user)

    try:
        deal = await deal_service.submit_for_signatures(deal)
        return deal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{deal_id}/cancel", response_model=DealSchema)
async def cancel_deal(
    deal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)
    
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    require_deal_owner(deal, current_user)

    try:
        deal = await deal_service.cancel(deal)
        return deal
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

