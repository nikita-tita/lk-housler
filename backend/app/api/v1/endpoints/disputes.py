"""Dispute API endpoints (TASK-2.3 - Updated with DisputeService)"""

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.dispute import Dispute, DisputeEvidence, DisputeStatus
from app.schemas.dispute import (
    DisputeCreate,
    DisputeResponse,
    DisputeListResponse,
    DisputeEvidenceCreate,
    DisputeEvidenceResponse,
    DisputeResolve,
)
from app.services.dispute import DisputeService
from app.services.bank_split import BankSplitDealService

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Dispute endpoints
# ============================================


@router.post("/bank-split/{deal_id}/dispute", response_model=DisputeResponse, status_code=status.HTTP_201_CREATED)
async def create_dispute(
    deal_id: UUID,
    dispute_in: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Open a dispute for a deal.

    Only deal participants can open disputes.
    This will:
    - Lock the deal (dispute_locked=True)
    - Change deal status to DISPUTE
    - Set escalation timers (agency 24h, max 7d)
    """
    # Validate reason
    valid_reasons = [
        "service_not_provided",
        "service_quality",
        "incorrect_amount",
        "duplicate_payment",
        "unauthorized_payment",
        "other",
    ]
    if dispute_in.reason not in valid_reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reason. Must be one of: {valid_reasons}"
        )

    service = DisputeService(db)
    dispute = await service.create_dispute(
        deal_id=deal_id,
        user_id=current_user.id,
        reason=dispute_in.reason,
        description=dispute_in.description,
        refund_requested=dispute_in.refund_requested,
        refund_amount=dispute_in.refund_amount,
    )

    return DisputeResponse.model_validate(dispute)


@router.get("/disputes/{dispute_id}", response_model=DisputeResponse)
async def get_dispute(
    dispute_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dispute by ID"""
    service = DisputeService(db)
    dispute = await service.get_dispute(dispute_id)

    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dispute not found"
        )

    # Get deal to check access
    deal_service = BankSplitDealService(db)
    deal = await deal_service.get_deal(dispute.deal_id)

    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    # Check access (participant or admin)
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id or
        dispute.initiator_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return DisputeResponse.model_validate(dispute)


@router.get("/bank-split/{deal_id}/disputes", response_model=List[DisputeResponse])
async def get_deal_disputes(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all disputes for a deal"""
    deal_service = BankSplitDealService(db)
    deal = await deal_service.get_deal(deal_id)

    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service = DisputeService(db)
    disputes = await service.get_deal_disputes(deal_id)

    return [DisputeResponse.model_validate(d) for d in disputes]


@router.post("/disputes/{dispute_id}/evidence", response_model=DisputeEvidenceResponse, status_code=status.HTTP_201_CREATED)
async def add_evidence(
    dispute_id: UUID,
    evidence_in: DisputeEvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add evidence to a dispute"""
    service = DisputeService(db)
    dispute = await service.get_dispute(dispute_id)

    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dispute not found"
        )

    # Check if dispute is still open
    open_statuses = [
        DisputeStatus.OPEN.value,
        DisputeStatus.AGENCY_REVIEW.value,
        DisputeStatus.PLATFORM_REVIEW.value,
        "open",
        "agency_review",
        "platform_review",
    ]
    if dispute.status not in open_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add evidence to closed dispute"
        )

    # Get deal to check access
    deal_service = BankSplitDealService(db)
    deal = await deal_service.get_deal(dispute.deal_id)

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id or
        dispute.initiator_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Validate file type
    valid_types = ["image", "pdf", "document"]
    if evidence_in.file_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Must be one of: {valid_types}"
        )

    # Create evidence
    evidence = DisputeEvidence(
        dispute_id=dispute_id,
        file_url=evidence_in.file_url,
        file_name=evidence_in.file_name,
        file_type=evidence_in.file_type,
        file_size=evidence_in.file_size,
        description=evidence_in.description,
        uploaded_by_user_id=current_user.id,
    )

    db.add(evidence)
    await db.commit()
    await db.refresh(evidence)

    return DisputeEvidenceResponse.model_validate(evidence)


@router.post("/disputes/{dispute_id}/cancel", response_model=DisputeResponse)
async def cancel_dispute(
    dispute_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a dispute (by initiator only).

    This will:
    - Unlock the deal (dispute_locked=False)
    - Return deal to HOLD_PERIOD status
    """
    service = DisputeService(db)
    dispute = await service.cancel_dispute(
        dispute_id=dispute_id,
        user_id=current_user.id,
    )

    return DisputeResponse.model_validate(dispute)


@router.post("/disputes/{dispute_id}/escalate", response_model=DisputeResponse)
async def escalate_dispute(
    dispute_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Escalate dispute to platform level (admin only).

    This will:
    - Change escalation_level from 'agency' to 'platform'
    - Set platform_deadline (72h from now)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = DisputeService(db)
    dispute = await service.escalate_to_platform(dispute_id)

    return DisputeResponse.model_validate(dispute)


# ============================================
# Admin endpoints
# ============================================


@router.post("/disputes/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: UUID,
    resolve_in: DisputeResolve,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a dispute (admin only).

    This will:
    - Set resolution and mark as resolved
    - Unlock the deal (dispute_locked=False)
    - Process refund/release based on resolution:
      - full_refund: Cancel deal in T-Bank, refund to payer
      - partial_refund: Process partial refund
      - no_refund: Release funds to recipients
      - split_adjustment: Release with adjusted splits
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    service = DisputeService(db)
    dispute = await service.resolve_dispute(
        dispute_id=dispute_id,
        resolution=resolve_in.resolution,
        admin_user_id=current_user.id,
        resolution_notes=resolve_in.resolution_notes,
        refund_amount=resolve_in.refund_amount,
    )

    return DisputeResponse.model_validate(dispute)


@router.get("/admin/disputes", response_model=DisputeListResponse)
async def list_disputes_admin(
    dispute_status: str = None,
    escalation_level: str = None,
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all disputes (admin only).

    Filters:
    - dispute_status: Filter by status (open, agency_review, platform_review, resolved, etc.)
    - escalation_level: Filter by escalation level (agency, platform)
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    query = select(Dispute).options(selectinload(Dispute.evidence))

    if dispute_status:
        query = query.where(Dispute.status == dispute_status)

    if escalation_level:
        query = query.where(Dispute.escalation_level == escalation_level)

    # Count total
    count_query = select(func.count(Dispute.id))
    if dispute_status:
        count_query = count_query.where(Dispute.status == dispute_status)
    if escalation_level:
        count_query = count_query.where(Dispute.escalation_level == escalation_level)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Paginate
    query = query.order_by(Dispute.created_at.desc()).offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    disputes = result.scalars().all()

    return DisputeListResponse(
        items=[DisputeResponse.model_validate(d) for d in disputes],
        total=total,
        page=page,
        size=size,
    )
