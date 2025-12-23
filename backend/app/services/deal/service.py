"""Deal service implementation"""

from typing import List, Optional, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deal import Deal, DealParty, DealTerms, DealStatus, PartyType
from app.models.user import User
from app.schemas.deal import DealCreate, DealUpdate
from app.services.user.service import UserService


class DealService:
    """Deal service"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
    
    async def get_by_id(self, deal_id: UUID) -> Optional[Deal]:
        """Get deal by ID"""
        stmt = (
            select(Deal)
            .where(Deal.id == deal_id)
            .options(
                selectinload(Deal.parties),
                selectinload(Deal.terms)
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_deals(
        self,
        user: User,
        status: Optional[DealStatus] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Tuple[List[Deal], int]:
        """List deals for user"""
        # Base query: deals where user is creator or agent
        stmt = (
            select(Deal)
            .where(
                (Deal.created_by_user_id == user.id) |
                (Deal.agent_user_id == user.id)
            )
        )
        
        if status:
            stmt = stmt.where(Deal.status == status)
        
        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar()
        
        # Paginate
        stmt = (
            stmt
            .order_by(Deal.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        
        result = await self.db.execute(stmt)
        deals = list(result.scalars().all())
        
        return deals, total
    
    async def create(
        self,
        deal_in: DealCreate,
        creator: User
    ) -> Deal:
        """Create new deal"""
        # Validate split rule percentages add up to 100
        split_total = sum(deal_in.terms.split_rule.values())
        if split_total != 100:
            raise ValueError(f"Split percentages must add up to 100, got {split_total}")
        
        # Create deal
        deal = Deal(
            type=deal_in.type,
            created_by_user_id=creator.id,
            agent_user_id=creator.id,  # Creator is agent by default
            executor_type=deal_in.executor_type,
            executor_id=deal_in.executor_id,
            property_address=deal_in.property_address,
            status=DealStatus.DRAFT,
        )
        self.db.add(deal)
        await self.db.flush()
        
        # Create terms
        terms = DealTerms(
            deal_id=deal.id,
            commission_total=deal_in.terms.commission_total,
            payment_plan=deal_in.terms.payment_plan,
            split_rule=deal_in.terms.split_rule,
            milestone_rules=deal_in.terms.milestone_rules,
            cancellation_policy=deal_in.terms.cancellation_policy,
        )
        self.db.add(terms)
        
        # Create client party (external if not registered)
        client_party = DealParty(
            deal_id=deal.id,
            party_role="client",
            party_type=PartyType.EXTERNAL,
            display_name_snapshot=deal_in.client_name,
            phone_snapshot=deal_in.client_phone,
            signing_required=True,
            signing_order=1,
        )
        self.db.add(client_party)
        
        # Create executor party
        executor_party = DealParty(
            deal_id=deal.id,
            party_role="executor",
            party_type="org" if deal_in.executor_type == "org" else "user",
            party_id=deal_in.executor_id,
            display_name_snapshot=f"Executor {deal_in.executor_id}",  # TODO: get real name
            signing_required=True,
            signing_order=2,
        )
        self.db.add(executor_party)
        
        await self.db.flush()
        await self.db.refresh(deal, ["parties", "terms"])
        
        return deal
    
    async def update(
        self,
        deal: Deal,
        deal_in: DealUpdate
    ) -> Deal:
        """Update deal"""
        # Only allow updates to draft deals or specific fields
        if deal.status not in [DealStatus.DRAFT, DealStatus.AWAITING_SIGNATURES]:
            raise ValueError("Cannot update deal in current status")
        
        update_data = deal_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(deal, field, value)
        
        await self.db.flush()
        await self.db.refresh(deal)
        return deal
    
    async def submit_for_signatures(self, deal: Deal) -> Deal:
        """Submit deal for signatures"""
        if deal.status != DealStatus.DRAFT:
            raise ValueError("Can only submit draft deals")
        
        # TODO: Generate document, send notifications
        
        deal.status = DealStatus.AWAITING_SIGNATURES
        await self.db.flush()
        await self.db.refresh(deal)
        
        return deal
    
    async def cancel(self, deal: Deal, reason: Optional[str] = None) -> Deal:
        """Cancel deal"""
        if deal.status in [DealStatus.CLOSED, DealStatus.CANCELLED]:
            raise ValueError("Deal already closed or cancelled")
        
        # TODO: Handle refunds if payments made
        
        deal.status = DealStatus.CANCELLED
        await self.db.flush()
        await self.db.refresh(deal)
        
        return deal

