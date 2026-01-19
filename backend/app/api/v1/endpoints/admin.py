"""Admin API endpoints for bank-split management"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.deal import Deal
from app.models.dispute import Dispute
from app.models.bank_split import DealSplitRecipient
from app.services.analytics import AnalyticsService, ExportService, ExportFormat

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


# ============================================
# Export endpoints
# ============================================


def _get_export_response(
    data: bytes,
    format: ExportFormat,
    filename: str,
) -> Response:
    """Create response with appropriate content type for export"""
    if format == ExportFormat.CSV:
        media_type = "text/csv; charset=utf-8"
        filename = f"{filename}.csv"
    else:
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{filename}.xlsx"

    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/analytics/export/deals")
async def export_deals(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format: csv or xlsx"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export deals to CSV or Excel.

    Returns a file download with deals data for the current user.
    """
    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_deals(
        format=export_format,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status_filter,
    )

    filename = f"deals_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/analytics/export/payouts")
async def export_payouts(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format: csv or xlsx"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export payouts to CSV or Excel.

    Returns a file download with payout data for the current user.
    """
    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_payouts(
        format=export_format,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status_filter,
    )

    filename = f"payouts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/analytics/export/time-series")
async def export_time_series(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format: csv or xlsx"),
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export time series data to CSV or Excel.

    Returns daily deal statistics for charting.
    """
    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_time_series(
        format=export_format,
        days=days,
        user_id=current_user.id,
    )

    filename = f"time_series_{days}d_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/analytics/export/summary")
async def export_summary(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format: csv or xlsx"),
    start_date: Optional[datetime] = Query(None, description="Filter from date"),
    end_date: Optional[datetime] = Query(None, description="Filter to date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export summary statistics to CSV or Excel.

    Returns aggregated statistics for the current user.
    """
    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_summary(
        format=export_format,
        user_id=current_user.id,
        start_date=start_date,
        end_date=end_date,
    )

    filename = f"summary_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


# ============================================
# Admin Export endpoints (all data)
# ============================================


@router.get("/admin/export/deals")
async def admin_export_deals(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export ALL deals (admin only)"""
    require_admin(current_user)

    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_deals(
        format=export_format,
        user_id=None,  # All users
        start_date=start_date,
        end_date=end_date,
        status_filter=status_filter,
    )

    filename = f"all_deals_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/admin/export/payouts")
async def admin_export_payouts(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export ALL payouts (admin only)"""
    require_admin(current_user)

    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_payouts(
        format=export_format,
        user_id=None,  # All users
        start_date=start_date,
        end_date=end_date,
        status_filter=status_filter,
    )

    filename = f"all_payouts_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/admin/export/disputes")
async def admin_export_disputes(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export ALL disputes (admin only)"""
    require_admin(current_user)

    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_disputes(
        format=export_format,
        start_date=start_date,
        end_date=end_date,
        status_filter=status_filter,
    )

    filename = f"all_disputes_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


@router.get("/admin/export/summary")
async def admin_export_summary(
    format: str = Query("csv", regex="^(csv|xlsx)$", description="Export format"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export global summary statistics (admin only)"""
    require_admin(current_user)

    export_service = ExportService(db)
    export_format = ExportFormat(format)

    data = await export_service.export_summary(
        format=export_format,
        user_id=None,  # Global stats
        start_date=start_date,
        end_date=end_date,
    )

    filename = f"global_summary_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    return _get_export_response(data, export_format, filename)


# ============================================
# Webhook DLQ endpoints (admin only)
# ============================================


@router.get("/admin/webhooks/dlq")
async def list_dlq_entries(
    resolved: bool = Query(False, description="Show resolved entries"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List webhook Dead Letter Queue entries.

    DLQ contains failed webhook events that need manual review or retry.
    """
    require_admin(current_user)

    from app.services.bank_split.webhook_service import WebhookService

    webhook_service = WebhookService(db)
    entries, total = await webhook_service.get_dlq_entries(
        resolved=resolved,
        limit=limit,
        offset=offset,
    )

    return {
        "items": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "error_message": e.error_message,
                "retry_count": e.retry_count,
                "last_retry_at": e.last_retry_at.isoformat() if e.last_retry_at else None,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "deal_id": str(e.deal_id) if e.deal_id else None,
                "created_at": e.created_at.isoformat(),
            }
            for e in entries
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/admin/webhooks/dlq/{dlq_id}")
async def get_dlq_entry(
    dlq_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed DLQ entry including full payload.
    """
    require_admin(current_user)

    from app.services.bank_split.webhook_service import WebhookService

    webhook_service = WebhookService(db)
    entry = await webhook_service.get_dlq_entry(dlq_id)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="DLQ entry not found"
        )

    return {
        "id": str(entry.id),
        "event_type": entry.event_type,
        "payload": entry.payload,
        "error_message": entry.error_message,
        "retry_count": entry.retry_count,
        "last_retry_at": entry.last_retry_at.isoformat() if entry.last_retry_at else None,
        "resolved_at": entry.resolved_at.isoformat() if entry.resolved_at else None,
        "deal_id": str(entry.deal_id) if entry.deal_id else None,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


@router.post("/admin/webhooks/dlq/{dlq_id}/retry")
async def retry_dlq_entry(
    dlq_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark DLQ entry for retry.

    This increments the retry count and updates last_retry_at.
    Actual retry logic should be handled by a background worker.
    """
    require_admin(current_user)

    from app.services.bank_split.webhook_service import WebhookService

    webhook_service = WebhookService(db)

    try:
        entry = await webhook_service.retry_dlq_entry(dlq_id)
        await db.commit()

        return {
            "id": str(entry.id),
            "retry_count": entry.retry_count,
            "last_retry_at": entry.last_retry_at.isoformat(),
            "message": "Entry marked for retry"
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/admin/webhooks/dlq/{dlq_id}/resolve")
async def resolve_dlq_entry(
    dlq_id: UUID,
    notes: Optional[str] = Query(None, description="Resolution notes"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark DLQ entry as resolved.

    Use this when the issue has been manually resolved or is no longer relevant.
    """
    require_admin(current_user)

    from app.services.bank_split.webhook_service import WebhookService

    webhook_service = WebhookService(db)

    try:
        entry = await webhook_service.resolve_dlq_entry(dlq_id, resolution_notes=notes)
        await db.commit()

        return {
            "id": str(entry.id),
            "resolved_at": entry.resolved_at.isoformat(),
            "message": "Entry resolved"
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
