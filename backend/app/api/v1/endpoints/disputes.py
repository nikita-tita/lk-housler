"""Dispute API endpoints"""

import logging
from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.dispute import Dispute, DisputeEvidence, DisputeStatus, RefundStatus
from app.schemas.dispute import (
    DisputeCreate,
    DisputeResponse,
    DisputeListResponse,
    DisputeEvidenceCreate,
    DisputeEvidenceResponse,
    DisputeResolve,
)
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
    """
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check if user is participant
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only deal participants can open disputes")

    # Check if there's already an open dispute
    existing = await db.execute(
        select(Dispute).where(
            Dispute.deal_id == deal_id,
            Dispute.status.in_(["open", "under_review"])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="There is already an open dispute for this deal"
        )

    # Validate reason
    valid_reasons = ["service_not_provided", "service_quality", "incorrect_amount", "duplicate_payment", "unauthorized_payment", "other"]
    if dispute_in.reason not in valid_reasons:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid reason. Must be one of: {valid_reasons}"
        )

    # Create dispute
    dispute = Dispute(
        deal_id=deal_id,
        initiator_user_id=current_user.id,
        reason=dispute_in.reason,
        description=dispute_in.description,
        refund_requested=dispute_in.refund_requested,
        refund_amount=dispute_in.refund_amount if dispute_in.refund_requested else None,
        refund_status=RefundStatus.REQUESTED.value if dispute_in.refund_requested else RefundStatus.NOT_REQUESTED.value,
    )

    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)

    return DisputeResponse.model_validate(dispute)


@router.get("/disputes/{dispute_id}", response_model=DisputeResponse)
async def get_dispute(
    dispute_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dispute by ID"""
    result = await db.execute(
        select(Dispute)
        .options(selectinload(Dispute.evidence))
        .where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()

    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    # Get deal to check access
    service = BankSplitDealService(db)
    deal = await service.get_deal(dispute.deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access (participant or admin)
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id or
        dispute.initiator_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return DisputeResponse.model_validate(dispute)


@router.get("/bank-split/{deal_id}/disputes", response_model=List[DisputeResponse])
async def get_deal_disputes(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all disputes for a deal"""
    service = BankSplitDealService(db)
    deal = await service.get_deal(deal_id)

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    # Check access
    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(Dispute)
        .options(selectinload(Dispute.evidence))
        .where(Dispute.deal_id == deal_id)
        .order_by(Dispute.created_at.desc())
    )
    disputes = result.scalars().all()

    return [DisputeResponse.model_validate(d) for d in disputes]


@router.post("/disputes/{dispute_id}/evidence", response_model=DisputeEvidenceResponse, status_code=status.HTTP_201_CREATED)
async def add_evidence(
    dispute_id: UUID,
    evidence_in: DisputeEvidenceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add evidence to a dispute"""
    dispute = await db.get(Dispute, dispute_id)

    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    # Check if dispute is still open
    if dispute.status not in ["open", "under_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add evidence to closed dispute"
        )

    # Get deal to check access
    service = BankSplitDealService(db)
    deal = await service.get_deal(dispute.deal_id)

    is_participant = (
        deal.created_by_user_id == current_user.id or
        deal.agent_user_id == current_user.id or
        dispute.initiator_user_id == current_user.id
    )
    is_admin = current_user.role == "admin"

    if not is_participant and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

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
    """Cancel a dispute (by initiator)"""
    dispute = await db.get(Dispute, dispute_id)

    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    if dispute.initiator_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only initiator can cancel")

    if dispute.status not in ["open", "under_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel dispute in this status"
        )

    dispute.status = DisputeStatus.CANCELLED.value
    await db.commit()
    await db.refresh(dispute)

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

    This sets the resolution and may trigger a refund.
    """
    # Check admin role
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(
        select(Dispute)
        .options(selectinload(Dispute.evidence))
        .where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()

    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    if dispute.status not in ["open", "under_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dispute is already resolved or cancelled"
        )

    # Validate resolution
    valid_resolutions = ["full_refund", "partial_refund", "no_refund", "split_adjustment"]
    if resolve_in.resolution not in valid_resolutions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid resolution. Must be one of: {valid_resolutions}"
        )

    # Update dispute
    dispute.status = DisputeStatus.RESOLVED.value
    dispute.resolution = resolve_in.resolution
    dispute.resolution_notes = resolve_in.resolution_notes
    dispute.resolved_by_user_id = current_user.id
    dispute.resolved_at = datetime.utcnow()

    # Handle refund
    if resolve_in.resolution in ["full_refund", "partial_refund"]:
        if resolve_in.resolution == "partial_refund" and not resolve_in.refund_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Refund amount required for partial refund"
            )

        dispute.refund_status = RefundStatus.APPROVED.value
        if resolve_in.refund_amount:
            dispute.refund_amount = resolve_in.refund_amount

        # TODO: Trigger actual refund via T-Bank
        # This would call the refund_deal function in tbank/deals.py

    await db.commit()
    await db.refresh(dispute)

    return DisputeResponse.model_validate(dispute)


@router.get("/admin/disputes", response_model=DisputeListResponse)
async def list_disputes_admin(
    status: str = None,
    page: int = 1,
    size: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all disputes (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    query = select(Dispute).options(selectinload(Dispute.evidence))

    if status:
        query = query.where(Dispute.status == status)

    # Count total
    from sqlalchemy import func
    count_query = select(func.count(Dispute.id))
    if status:
        count_query = count_query.where(Dispute.status == status)
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
