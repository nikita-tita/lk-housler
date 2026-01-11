"""Deal endpoints"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_deal_access, require_deal_owner
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.deal import DealStatus
from app.schemas.deal import (
    Deal as DealSchema,
    DealUpdate,
    DealCreateSimple,
    DealSimpleResponse,
    DealListSimple,
)
from app.services.deal.service import DealService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=DealListSimple)
async def list_deals(
    status: Optional[DealStatus] = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's deals"""
    deal_service = DealService(db)
    deals, total = await deal_service.list_deals(current_user, status=status, page=page, page_size=size)

    # Convert to simplified response
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


@router.post("", response_model=DealSimpleResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_in: DealCreateSimple, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{deal_id}", response_model=DealSchema)
async def get_deal(deal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get deal by ID"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_access(deal, current_user)

    return deal


@router.put("/{deal_id}", response_model=DealSchema)
async def update_deal(
    deal_id: str,
    deal_in: DealUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_access(deal, current_user)

    try:
        deal = await deal_service.update(deal, deal_in)
        return deal
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/submit", response_model=DealSchema)
async def submit_deal(deal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Submit deal for signatures"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_owner(deal, current_user)

    try:
        deal = await deal_service.submit_for_signatures(deal)
        return deal
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/cancel", response_model=DealSchema)
async def cancel_deal(deal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Cancel deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_owner(deal, current_user)

    try:
        deal = await deal_service.cancel(deal)
        return deal
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{deal_id}/send-for-signing")
async def send_deal_for_signing(
    deal_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Generate document and send signing link to client via SMS"""
    from app.services.document.service import DocumentService
    from app.services.notification.service import NotificationService
    from app.api.v1.endpoints.sign import create_signing_token
    from app.models.deal import DealParty, PartyRole
    from sqlalchemy import select

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    require_deal_owner(deal, current_user)

    if deal.status != DealStatus.DRAFT:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only send draft deals for signing")

    # Generate document
    doc_service = DocumentService(db)
    try:
        document = await doc_service.generate_contract(deal)
    except Exception as e:
        logger.error(f"Failed to generate document for deal {deal_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate document. Please try again later.",
        )

    # Find client party
    stmt = select(DealParty).where(DealParty.deal_id == deal.id, DealParty.party_role == PartyRole.CLIENT)
    result = await db.execute(stmt)
    client_party = result.scalar_one_or_none()

    # If no client party exists, create one
    if not client_party and deal.client_phone:
        client_party = DealParty(
            deal_id=deal.id,
            party_role=PartyRole.CLIENT,
            party_type="external",
            display_name_snapshot=deal.client_name or "Клиент",
            phone_snapshot=deal.client_phone,
            signing_required=True,
            signing_order=1,
        )
        db.add(client_party)
        await db.flush()

    if not client_party:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client phone number for deal")

    # Create signing token
    phone = client_party.phone_snapshot or deal.client_phone
    if not phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client phone number is required")

    signing_token = await create_signing_token(db=db, document_id=document.id, party_id=client_party.id, phone=phone)

    # Build signing URL
    signing_url = f"{settings.FRONTEND_URL}/sign/{signing_token.token}"

    # Send SMS
    notification = NotificationService()
    sms_sent = await notification.send_signing_link(phone=phone, signing_url=signing_url, client_name=deal.client_name)

    # Update deal status
    deal.status = DealStatus.AWAITING_SIGNATURES
    await db.commit()

    return {
        "success": True,
        "document_id": str(document.id),
        "signing_token": signing_token.token,
        "signing_url": signing_url,
        "sms_sent": sms_sent,
        "message": "Signing link sent to client" if sms_sent else "Signing link created (SMS failed)",
    }
