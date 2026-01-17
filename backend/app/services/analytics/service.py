"""Analytics service for bank-split deals"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal
from app.models.bank_split import DealSplitRecipient, BankEvent
from app.models.dispute import Dispute
from app.models.contract import SignedContract

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Service for calculating analytics and statistics for bank-split deals.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_deal_statistics(
        self,
        user_id: Optional[int] = None,
        organization_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Get deal statistics.

        Args:
            user_id: Filter by user (agent)
            organization_id: Filter by organization
            start_date: Start date filter
            end_date: End date filter

        Returns:
            Statistics dictionary
        """
        # Base query
        base_query = select(Deal).where(Deal.payment_model == "bank_hold_split")

        if user_id:
            base_query = base_query.where(Deal.agent_user_id == user_id)

        if start_date:
            base_query = base_query.where(Deal.created_at >= start_date)

        if end_date:
            base_query = base_query.where(Deal.created_at <= end_date)

        # Get all matching deals
        result = await self.db.execute(base_query)
        deals = result.scalars().all()

        # Calculate statistics
        total_deals = len(deals)
        deals_by_status = {}
        total_volume = Decimal("0")
        total_commission = Decimal("0")

        for deal in deals:
            # Count by status
            status = deal.status or "unknown"
            deals_by_status[status] = deals_by_status.get(status, 0) + 1

            # Sum volumes
            if deal.price:
                total_volume += deal.price
            if deal.commission_agent:
                total_commission += deal.commission_agent

        return {
            "total_deals": total_deals,
            "deals_by_status": deals_by_status,
            "total_volume": float(total_volume),
            "total_commission": float(total_commission),
            "avg_deal_size": float(total_volume / total_deals) if total_deals > 0 else 0,
            "avg_commission": float(total_commission / total_deals) if total_deals > 0 else 0,
        }

    async def get_payout_statistics(
        self,
        user_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get payout statistics for split recipients"""
        query = select(DealSplitRecipient)

        if user_id:
            query = query.where(DealSplitRecipient.user_id == user_id)

        if start_date:
            query = query.where(DealSplitRecipient.created_at >= start_date)

        if end_date:
            query = query.where(DealSplitRecipient.created_at <= end_date)

        result = await self.db.execute(query)
        recipients = result.scalars().all()

        total_pending = Decimal("0")
        total_paid = Decimal("0")
        payout_by_status = {}

        for r in recipients:
            status = r.payout_status or "unknown"
            amount = r.calculated_amount or Decimal("0")

            payout_by_status[status] = payout_by_status.get(status, Decimal("0")) + amount

            if status == "pending":
                total_pending += amount
            elif status in ("paid", "completed"):
                total_paid += amount

        return {
            "total_pending": float(total_pending),
            "total_paid": float(total_paid),
            "payout_by_status": {k: float(v) for k, v in payout_by_status.items()},
            "recipients_count": len(recipients),
        }

    async def get_dispute_statistics(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Get dispute statistics"""
        query = select(Dispute)

        if start_date:
            query = query.where(Dispute.created_at >= start_date)

        if end_date:
            query = query.where(Dispute.created_at <= end_date)

        result = await self.db.execute(query)
        disputes = result.scalars().all()

        disputes_by_status = {}
        disputes_by_reason = {}
        total_refund = Decimal("0")

        for d in disputes:
            status = d.status or "unknown"
            disputes_by_status[status] = disputes_by_status.get(status, 0) + 1

            reason = d.reason or "unknown"
            disputes_by_reason[reason] = disputes_by_reason.get(reason, 0) + 1

            if d.refund_amount:
                total_refund += d.refund_amount

        return {
            "total_disputes": len(disputes),
            "disputes_by_status": disputes_by_status,
            "disputes_by_reason": disputes_by_reason,
            "total_refund_amount": float(total_refund),
            "open_disputes": disputes_by_status.get("open", 0),
        }

    async def get_time_series(
        self,
        days: int = 30,
        user_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Get daily deal creation time series"""
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        query = select(Deal).where(
            and_(
                Deal.payment_model == "bank_hold_split",
                Deal.created_at >= start_date,
                Deal.created_at <= end_date,
            )
        )

        if user_id:
            query = query.where(Deal.agent_user_id == user_id)

        result = await self.db.execute(query)
        deals = result.scalars().all()

        # Group by date
        daily_data = {}
        for deal in deals:
            date_key = deal.created_at.strftime("%Y-%m-%d")
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "date": date_key,
                    "deals_count": 0,
                    "volume": Decimal("0"),
                    "commission": Decimal("0"),
                }

            daily_data[date_key]["deals_count"] += 1
            if deal.price:
                daily_data[date_key]["volume"] += deal.price
            if deal.commission_agent:
                daily_data[date_key]["commission"] += deal.commission_agent

        # Fill missing dates with zeros
        series = []
        current = start_date
        while current <= end_date:
            date_key = current.strftime("%Y-%m-%d")
            if date_key in daily_data:
                data = daily_data[date_key]
                series.append({
                    "date": date_key,
                    "deals_count": data["deals_count"],
                    "volume": float(data["volume"]),
                    "commission": float(data["commission"]),
                })
            else:
                series.append({
                    "date": date_key,
                    "deals_count": 0,
                    "volume": 0,
                    "commission": 0,
                })
            current += timedelta(days=1)

        return series

    async def get_agent_leaderboard(
        self,
        limit: int = 10,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Get top agents by deal volume"""
        query = select(
            Deal.agent_user_id,
            func.count(Deal.id).label("deals_count"),
            func.sum(Deal.commission_agent).label("total_commission"),
        ).where(
            Deal.payment_model == "bank_hold_split"
        ).group_by(Deal.agent_user_id)

        if start_date:
            query = query.where(Deal.created_at >= start_date)

        if end_date:
            query = query.where(Deal.created_at <= end_date)

        query = query.order_by(func.sum(Deal.commission_agent).desc()).limit(limit)

        result = await self.db.execute(query)
        rows = result.fetchall()

        return [
            {
                "agent_user_id": row.agent_user_id,
                "deals_count": row.deals_count,
                "total_commission": float(row.total_commission) if row.total_commission else 0,
            }
            for row in rows
        ]

    async def get_dashboard_summary(
        self,
        user_id: int,
    ) -> Dict[str, Any]:
        """Get agent dashboard summary"""
        # Current month
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Get statistics
        stats = await self.get_deal_statistics(user_id=user_id, start_date=month_start)
        payouts = await self.get_payout_statistics(user_id=user_id)

        # Get recent deals
        query = select(Deal).where(
            and_(
                Deal.payment_model == "bank_hold_split",
                Deal.agent_user_id == user_id,
            )
        ).order_by(Deal.created_at.desc()).limit(5)

        result = await self.db.execute(query)
        recent_deals = result.scalars().all()

        return {
            "month_stats": stats,
            "payouts": payouts,
            "recent_deals": [
                {
                    "id": str(d.id),
                    "property_address": d.property_address,
                    "status": d.status,
                    "commission": float(d.commission_agent) if d.commission_agent else 0,
                    "created_at": d.created_at.isoformat(),
                }
                for d in recent_deals
            ],
        }
