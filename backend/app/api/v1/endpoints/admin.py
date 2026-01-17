"""Admin API endpoints for bank-split management"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.deal import Deal
from app.models.dispute import Dispute
from app.models.bank_split import DealSplitRecipient
from app.services.analytics import AnalyticsService

logger = logging.getLogger(__name__)
router = APIRouter()


def require_admin(user: User):
    """Check if user is admin"""
    # For now, check if user has admin role
    # In production, this should check user.role or similar
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


# ============================================
# Dashboard / Analytics endpoints
# ============================================


@router.get("/dashboard")
async def get_agent_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get agent dashboard summary"""
    analytics = AnalyticsService(db)
    return await analytics.get_dashboard_summary(current_user.id)


@router.get("/analytics/deals")
async def get_deal_analytics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get deal analytics for current user"""
    analytics = AnalyticsService(db)
    return await analytics.get_deal_statistics(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/payouts")
async def get_payout_analytics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get payout analytics for current user"""
    analytics = AnalyticsService(db)
    return await analytics.get_payout_statistics(
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/analytics/time-series")
async def get_time_series(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get deal time series for charting"""
    analytics = AnalyticsService(db)
    return await analytics.get_time_series(
        days=days,
        user_id=current_user.id,
    )


# ============================================
# Admin endpoints (require admin role)
# ============================================


@router.get("/admin/analytics/global")
async def get_global_analytics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get global analytics (admin only)"""
    require_admin(current_user)

    analytics = AnalyticsService(db)

    deal_stats = await analytics.get_deal_statistics(
        start_date=start_date,
        end_date=end_date,
    )

    payout_stats = await analytics.get_payout_statistics(
        start_date=start_date,
        end_date=end_date,
    )

    dispute_stats = await analytics.get_dispute_statistics(
        start_date=start_date,
        end_date=end_date,
    )

    return {
        "deals": deal_stats,
        "payouts": payout_stats,
        "disputes": dispute_stats,
    }


@router.get("/admin/analytics/leaderboard")
async def get_leaderboard(
    limit: int = Query(10, ge=1, le=100),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get agent leaderboard (admin only)"""
    require_admin(current_user)

    analytics = AnalyticsService(db)
    return await analytics.get_agent_leaderboard(
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/admin/deals")
async def list_all_deals(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bank-split deals (admin only)"""
    require_admin(current_user)

    query = select(Deal).where(
        Deal.payment_model == "bank_hold_split"
    ).order_by(Deal.created_at.desc())

    if status:
        query = query.where(Deal.status == status)

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    deals = result.scalars().all()

    # Count total
    count_query = select(func.count(Deal.id)).where(
        Deal.payment_model == "bank_hold_split"
    )
    if status:
        count_query = count_query.where(Deal.status == status)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    return {
        "items": [
            {
                "id": str(d.id),
                "property_address": d.property_address,
                "status": d.status,
                "agent_user_id": d.agent_user_id,
                "client_name": d.client_name,
                "commission": float(d.commission_agent) if d.commission_agent else 0,
                "created_at": d.created_at.isoformat(),
            }
            for d in deals
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/admin/disputes")
async def list_all_disputes(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all disputes (admin only)"""
    require_admin(current_user)

    query = select(Dispute).order_by(Dispute.created_at.desc())

    if status:
        query = query.where(Dispute.status == status)

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    disputes = result.scalars().all()

    # Count total
    count_query = select(func.count(Dispute.id))
    if status:
        count_query = count_query.where(Dispute.status == status)

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    return {
        "items": [
            {
                "id": str(d.id),
                "deal_id": str(d.deal_id),
                "initiator_user_id": d.initiator_user_id,
                "reason": d.reason,
                "status": d.status,
                "refund_requested": d.refund_requested,
                "refund_amount": float(d.refund_amount) if d.refund_amount else None,
                "created_at": d.created_at.isoformat(),
            }
            for d in disputes
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/admin/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: UUID,
    resolution: str = Query(...),
    notes: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a dispute (admin only)"""
    require_admin(current_user)

    result = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()

    if not dispute:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispute not found")

    if dispute.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dispute is already {dispute.status}"
        )

    dispute.status = "resolved"
    dispute.resolution = resolution
    dispute.resolution_notes = notes
    dispute.resolved_by_user_id = current_user.id
    dispute.resolved_at = datetime.utcnow()

    await db.commit()

    return {
        "id": str(dispute.id),
        "status": dispute.status,
        "resolution": dispute.resolution,
        "resolved_at": dispute.resolved_at.isoformat(),
    }


@router.get("/admin/payouts/pending")
async def list_pending_payouts(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending payouts (admin only)"""
    require_admin(current_user)

    query = select(DealSplitRecipient).where(
        DealSplitRecipient.payout_status == "pending"
    ).order_by(DealSplitRecipient.created_at.desc())

    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    recipients = result.scalars().all()

    # Count total
    count_query = select(func.count(DealSplitRecipient.id)).where(
        DealSplitRecipient.payout_status == "pending"
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    return {
        "items": [
            {
                "id": str(r.id),
                "deal_id": str(r.deal_id),
                "user_id": r.user_id,
                "role": r.role,
                "amount": float(r.calculated_amount) if r.calculated_amount else 0,
                "inn": r.inn,
                "created_at": r.created_at.isoformat(),
            }
            for r in recipients
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.post("/admin/payouts/{recipient_id}/mark-paid")
async def mark_payout_paid(
    recipient_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a payout as paid (admin only)"""
    require_admin(current_user)

    result = await db.execute(
        select(DealSplitRecipient).where(DealSplitRecipient.id == recipient_id)
    )
    recipient = result.scalar_one_or_none()

    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient not found")

    recipient.payout_status = "paid"
    recipient.paid_at = datetime.utcnow()

    await db.commit()

    return {
        "id": str(recipient.id),
        "payout_status": recipient.payout_status,
        "paid_at": recipient.paid_at.isoformat(),
    }
