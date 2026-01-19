"""NPD Receipt API endpoints.

TASK-3.3: NPD Receipt Tracking

Endpoints for self-employed (samozanyatye) to manage their NPD receipts:
- GET /receipts/pending - list pending receipts for current user
- POST /receipts/{id}/upload - upload receipt data
- GET /admin/receipts/overdue - list overdue receipts (admin only)
"""

import logging
from typing import Optional, List
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.models.fiscalization import FiscalReceiptStatus, NPDReceiptSource
from app.services.fiscalization.npd_service import NPDReceiptService

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================
# Pydantic Schemas
# ============================================


class NPDReceiptResponse(BaseModel):
    """NPD Receipt response schema"""
    id: UUID
    deal_id: UUID
    recipient_id: int
    amount: int  # in kopeks
    amount_rub: float  # for convenience
    status: str
    npd_receipt_number: Optional[str] = None
    receipt_url: Optional[str] = None
    npd_source: Optional[str] = None
    npd_uploaded_at: Optional[datetime] = None
    receipt_deadline: Optional[datetime] = None
    reminder_count: int = 0
    created_at: datetime
    # Deal info
    deal_address: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_deal(cls, receipt, deal_address: Optional[str] = None):
        """Create response from ORM object with deal info"""
        meta = receipt.meta or {}
        return cls(
            id=receipt.id,
            deal_id=receipt.deal_id,
            recipient_id=receipt.recipient_id,
            amount=receipt.amount,
            amount_rub=receipt.amount / 100,
            status=receipt.status,
            npd_receipt_number=receipt.npd_receipt_number,
            receipt_url=receipt.receipt_url,
            npd_source=receipt.npd_source,
            npd_uploaded_at=receipt.npd_uploaded_at,
            receipt_deadline=receipt.receipt_deadline,
            reminder_count=receipt.reminder_count,
            created_at=receipt.created_at,
            deal_address=deal_address or meta.get("deal_address"),
        )


class UploadReceiptRequest(BaseModel):
    """Request to upload NPD receipt data"""
    receipt_number: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Receipt number from Moy Nalog app"
    )
    receipt_url: Optional[str] = Field(
        None,
        max_length=500,
        description="URL to view receipt (optional)"
    )
    source: Optional[str] = Field(
        "my_nalog_app",
        description="Source of receipt data: my_nalog_app, my_nalog_api, manual"
    )


class ReceiptStatsResponse(BaseModel):
    """User receipt statistics"""
    pending: int
    uploaded: int
    total: int


class OverdueReceiptResponse(NPDReceiptResponse):
    """Extended response for admin view with recipient info"""
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    recipient_email: Optional[str] = None
    escalated_at: Optional[datetime] = None
    days_overdue: Optional[int] = None


# ============================================
# User endpoints
# ============================================


@router.get("/receipts/pending", response_model=List[NPDReceiptResponse])
async def get_pending_receipts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get pending NPD receipts for current user.

    Returns receipts that the current user needs to upload from "Moy Nalog" app.
    Only relevant for self-employed users who received payments.
    """
    service = NPDReceiptService(db)
    receipts = await service.get_pending_receipts(current_user.id)

    return [
        NPDReceiptResponse.from_orm_with_deal(
            r,
            deal_address=r.deal.property_address if r.deal else None
        )
        for r in receipts
    ]


@router.get("/receipts/stats", response_model=ReceiptStatsResponse)
async def get_receipt_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get receipt statistics for current user."""
    service = NPDReceiptService(db)
    stats = await service.get_user_receipt_stats(current_user.id)
    return ReceiptStatsResponse(**stats)


@router.get("/receipts/{receipt_id}", response_model=NPDReceiptResponse)
async def get_receipt(
    receipt_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific receipt by ID.

    User can only view their own receipts.
    """
    service = NPDReceiptService(db)
    receipt = await service.get_receipt(receipt_id)

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Check ownership
    if receipt.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this receipt"
        )

    return NPDReceiptResponse.from_orm_with_deal(
        receipt,
        deal_address=receipt.deal.property_address if receipt.deal else None
    )


@router.post("/receipts/{receipt_id}/upload", response_model=NPDReceiptResponse)
async def upload_receipt(
    receipt_id: UUID,
    data: UploadReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload NPD receipt data.

    Called when user uploads receipt number from "Moy Nalog" app.
    Only the receipt owner (recipient) can upload.
    """
    service = NPDReceiptService(db)
    receipt = await service.get_receipt(receipt_id)

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Check ownership
    if receipt.recipient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this receipt"
        )

    # Validate source
    try:
        source = NPDReceiptSource(data.source) if data.source else NPDReceiptSource.MY_NALOG_APP
    except ValueError:
        source = NPDReceiptSource.MY_NALOG_APP

    try:
        updated = await service.mark_receipt_uploaded(
            receipt_id=receipt_id,
            receipt_number=data.receipt_number,
            receipt_url=data.receipt_url,
            source=source,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    return NPDReceiptResponse.from_orm_with_deal(
        updated,
        deal_address=updated.deal.property_address if updated.deal else None
    )


# ============================================
# Admin endpoints
# ============================================


@router.get("/admin/receipts/overdue", response_model=List[OverdueReceiptResponse])
async def get_overdue_receipts(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get all overdue NPD receipts (admin only).

    Returns receipts where the deadline has passed but no receipt uploaded.
    Used for monitoring and follow-up.
    """
    service = NPDReceiptService(db)
    receipts = await service.get_overdue_receipts()

    now = datetime.utcnow()
    result = []

    for r in receipts:
        meta = r.meta or {}
        days_overdue = None
        if r.receipt_deadline:
            delta = now - r.receipt_deadline
            days_overdue = max(0, delta.days)

        result.append(OverdueReceiptResponse(
            id=r.id,
            deal_id=r.deal_id,
            recipient_id=r.recipient_id,
            amount=r.amount,
            amount_rub=r.amount / 100,
            status=r.status,
            npd_receipt_number=r.npd_receipt_number,
            receipt_url=r.receipt_url,
            npd_source=r.npd_source,
            npd_uploaded_at=r.npd_uploaded_at,
            receipt_deadline=r.receipt_deadline,
            reminder_count=r.reminder_count,
            created_at=r.created_at,
            deal_address=r.deal.property_address if r.deal else meta.get("deal_address"),
            recipient_name=r.recipient.name if r.recipient else meta.get("recipient_name"),
            recipient_phone=r.recipient.phone if r.recipient else None,
            recipient_email=r.recipient.email if r.recipient else None,
            escalated_at=r.escalated_at,
            days_overdue=days_overdue,
        ))

    return result


@router.post("/admin/receipts/check-overdue")
async def check_overdue_receipts(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger overdue receipt check (admin only).

    Sends reminders and marks receipts as overdue.
    Normally this is run as a background task.
    """
    service = NPDReceiptService(db)
    stats = await service.check_overdue_receipts()
    await db.commit()

    return {
        "status": "ok",
        "reminders_sent": stats["reminders_sent"],
        "marked_overdue": stats["marked_overdue"],
        "escalated": stats["escalated"],
    }


@router.post("/admin/receipts/{receipt_id}/remind")
async def send_receipt_reminder(
    receipt_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually send a reminder for a specific receipt (admin only)."""
    service = NPDReceiptService(db)
    success = await service.send_reminder(receipt_id)
    await db.commit()

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not send reminder for this receipt"
        )

    return {"status": "ok", "message": "Reminder sent"}
