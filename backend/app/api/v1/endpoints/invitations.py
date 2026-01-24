"""Invitation API endpoints for multi-agent deals"""

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import rate_limit_invitation_lookup
from app.db.session import get_db
from app.models.user import User
from app.models.invitation import DealInvitation, InvitationStatus
from app.models.bank_split import DealSplitRecipient
from app.schemas.invitation import (
    InvitationCreate,
    InvitationResponse,
    InvitationPublicInfo,
    InvitationAccept,
    InvitationDecline,
    InvitationResend,
    InvitationActionResponse,
)
from app.services.bank_split import BankSplitDealService

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Deal-scoped invitation endpoints
# ============================================


@router.post("/bank-split/{deal_id}/invite", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_invitation(
    deal_id: UUID,
    invitation_in: InvitationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invite a partner to join a deal.

    Only the deal creator can invite partners.
    """
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    if deal.created_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal creator can invite partners")

    # Check if deal is in a state that allows invitations
    if deal.status not in ('draft', 'awaiting_signatures'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot invite partners after deal is signed"
        )

    # Check if there's already a pending invitation for this phone
    existing = await db.execute(
        select(DealInvitation).where(
            DealInvitation.deal_id == deal_id,
            DealInvitation.invited_phone == invitation_in.invited_phone,
            DealInvitation.status == "pending"
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Pending invitation already exists for this phone number"
        )

    # Validate total split percent doesn't exceed 100%
    from sqlalchemy import func
    from sqlalchemy.sql import or_
    total_result = await db.execute(
        select(func.coalesce(func.sum(DealInvitation.split_percent), 0)).where(
            DealInvitation.deal_id == deal_id,
            or_(
                DealInvitation.status == "pending",
                DealInvitation.status == "accepted"
            )
        )
    )
    current_total = total_result.scalar() or 0
    if current_total + invitation_in.split_percent > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total split percent would exceed 100%. Current: {current_total}%, requested: {invitation_in.split_percent}%"
        )

    # Create invitation
    invitation = DealInvitation(
        deal_id=deal_id,
        invited_by_user_id=current_user.id,
        invited_phone=invitation_in.invited_phone,
        invited_email=invitation_in.invited_email,
        role=invitation_in.role,
        split_percent=invitation_in.split_percent,
    )

    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # Send invitation SMS
    await _send_invitation_sms(invitation, deal.property_address)

    return InvitationResponse.model_validate(invitation)


@router.get("/bank-split/{deal_id}/invitations", response_model=List[InvitationResponse])
async def get_deal_invitations(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all invitations for a deal"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    if deal.created_by_user_id != current_user.id and deal.agent_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(DealInvitation).where(DealInvitation.deal_id == deal_id)
    )
    invitations = result.scalars().all()

    return [InvitationResponse.model_validate(inv) for inv in invitations]


@router.delete("/bank-split/{deal_id}/invitations/{invitation_id}", response_model=InvitationActionResponse)
async def cancel_invitation(
    deal_id: UUID,
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending invitation"""
    invitation = await db.get(DealInvitation, invitation_id)

    if not invitation or invitation.deal_id != deal_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if invitation.invited_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only inviter can cancel")

    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invitation in status: {invitation.status}"
        )

    invitation.cancel()
    await db.commit()

    return InvitationActionResponse(
        invitation_id=invitation.id,
        status="cancelled",
        message="Invitation cancelled successfully"
    )


# ============================================
# Token-based public endpoints
# ============================================


@router.get("/invitations/{token}", response_model=InvitationPublicInfo)
async def get_invitation_by_token(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Get invitation info by token.

    This is a PUBLIC endpoint - no authentication required.
    Used by the invitation acceptance page.
    """
    # Rate limit by IP to prevent token enumeration
    await rate_limit_invitation_lookup(request)

    result = await db.execute(
        select(DealInvitation).where(DealInvitation.token == token)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    # Check if expired
    if invitation.is_expired and invitation.status == "pending":
        invitation.status = InvitationStatus.EXPIRED.value
        await db.commit()

    # Get deal info
    service = BankSplitDealService(db)
    deal = await service.get_deal(invitation.deal_id)

    # Get inviter name
    inviter = await db.get(User, invitation.invited_by_user_id)
    inviter_name = inviter.display_name if inviter else "Unknown"

    return InvitationPublicInfo(
        id=invitation.id,
        deal_id=invitation.deal_id,
        property_address=deal.property_address if deal else "Unknown",
        inviter_name=inviter_name,
        role=invitation.role,
        split_percent=invitation.split_percent,
        status=invitation.status,
        expires_at=invitation.expires_at,
        is_expired=invitation.is_expired,
    )


@router.post("/invitations/{token}/accept", response_model=InvitationActionResponse)
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept an invitation.

    Requires authentication - the accepting user becomes the co-agent/partner.
    """
    result = await db.execute(
        select(DealInvitation).where(DealInvitation.token == token)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if not invitation.can_respond:
        if invitation.is_expired:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is already {invitation.status}"
        )

    # Accept the invitation
    invitation.accept(current_user.id)

    # Create split recipient for the accepting user
    service = BankSplitDealService(db)
    deal = await service.get_deal(invitation.deal_id)

    if deal:
        recipient = DealSplitRecipient(
            deal_id=deal.id,
            role=invitation.role,
            user_id=current_user.id,
            split_type="percent",
            split_value=invitation.split_percent,
            payout_status="pending",
        )
        db.add(recipient)

    await db.commit()

    return InvitationActionResponse(
        invitation_id=invitation.id,
        status="accepted",
        message="Invitation accepted successfully. You are now a participant in this deal."
    )


@router.post("/invitations/{token}/decline", response_model=InvitationActionResponse)
async def decline_invitation(
    token: str,
    decline_request: InvitationDecline = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline an invitation"""
    result = await db.execute(
        select(DealInvitation).where(DealInvitation.token == token)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if not invitation.can_respond:
        if invitation.is_expired:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invitation is already {invitation.status}"
        )

    reason = decline_request.reason if decline_request else None
    invitation.decline(reason)
    await db.commit()

    return InvitationActionResponse(
        invitation_id=invitation.id,
        status="declined",
        message="Invitation declined"
    )


@router.post("/invitations/{invitation_id}/resend", response_model=InvitationActionResponse)
async def resend_invitation(
    invitation_id: UUID,
    resend_request: InvitationResend = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resend invitation SMS/Email"""
    invitation = await db.get(DealInvitation, invitation_id)

    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")

    if invitation.invited_by_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only inviter can resend")

    if invitation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot resend invitation in status: {invitation.status}"
        )

    # Limit resends
    if invitation.send_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum resend limit reached"
        )

    # Get deal info
    service = BankSplitDealService(db)
    deal = await service.get_deal(invitation.deal_id)

    method = resend_request.method if resend_request else "sms"

    if method == "sms":
        await _send_invitation_sms(invitation, deal.property_address if deal else "")
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Email delivery not implemented yet"
        )

    invitation.send_count += 1
    invitation.last_sent_at = datetime.utcnow()
    await db.commit()

    return InvitationActionResponse(
        invitation_id=invitation.id,
        status="resent",
        message=f"Invitation resent via {method}"
    )


# ============================================
# Helper functions
# ============================================


async def _send_invitation_sms(invitation: DealInvitation, property_address: str) -> bool:
    """Send invitation SMS"""
    from app.services.sms.provider import get_sms_provider

    invite_url = f"{settings.FRONTEND_URL}/invite/{invitation.token}"

    # Truncate address if too long
    address_short = property_address[:30] + "..." if len(property_address) > 30 else property_address

    message = f"Housler: Вас пригласили участвовать в сделке по адресу {address_short}. Подробности: {invite_url}"

    sms_provider = get_sms_provider()
    success = await sms_provider.send(invitation.invited_phone, message)

    if success:
        invitation.last_sent_at = datetime.utcnow()
        invitation.send_count += 1

    return success
