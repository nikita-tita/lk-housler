"""Deal service implementation"""

from typing import List, Optional, Tuple
from uuid import UUID
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deal import Deal, DealParty, DealTerms, DealStatus, PartyType, ExecutorType
from app.models.user import User
from app.schemas.deal import DealCreate, DealUpdate, DealCreateSimple
from app.services.user.service import UserService


# Valid state transitions for Deal
VALID_TRANSITIONS: dict[DealStatus, set[DealStatus]] = {
    DealStatus.DRAFT: {DealStatus.AWAITING_SIGNATURES, DealStatus.CANCELLED},
    DealStatus.AWAITING_SIGNATURES: {DealStatus.SIGNED, DealStatus.CANCELLED},
    DealStatus.SIGNED: {DealStatus.PAYMENT_PENDING, DealStatus.CANCELLED},
    DealStatus.PAYMENT_PENDING: {DealStatus.IN_PROGRESS, DealStatus.CANCELLED, DealStatus.DISPUTE},
    DealStatus.IN_PROGRESS: {DealStatus.CLOSED, DealStatus.DISPUTE, DealStatus.CANCELLED},
    DealStatus.DISPUTE: {DealStatus.IN_PROGRESS, DealStatus.CANCELLED},
    DealStatus.CLOSED: set(),  # Terminal state
    DealStatus.CANCELLED: set(),  # Terminal state
}


class DealService:
    """Deal service"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_service = UserService(db)
    
    async def get_by_id(self, deal_id: UUID, include_deleted: bool = False) -> Optional[Deal]:
        """Get deal by ID"""
        stmt = (
            select(Deal)
            .where(Deal.id == deal_id)
            .options(
                selectinload(Deal.parties),
                selectinload(Deal.terms)
            )
        )
        if not include_deleted:
            stmt = stmt.where(Deal.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_deals(
        self,
        user: User,
        status: Optional[DealStatus] = None,
        page: int = 1,
        page_size: int = 20,
        include_deleted: bool = False
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

        # Exclude soft-deleted by default
        if not include_deleted:
            stmt = stmt.where(Deal.deleted_at.is_(None))

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

    async def create_simple(
        self,
        deal_in: DealCreateSimple,
        creator: User
    ) -> Deal:
        """Create deal with simplified schema (MVP)"""
        # Build full address from structured input
        full_address = deal_in.address.to_full_address()

        # Create deal with simplified fields
        deal = Deal(
            type=deal_in.type,
            created_by_user_id=creator.id,
            agent_user_id=creator.id,
            executor_type=ExecutorType.USER,
            executor_id=creator.id,
            property_address=full_address,
            price=deal_in.price,
            commission_agent=deal_in.commission,
            client_name=deal_in.client_name,
            client_phone=deal_in.client_phone,
            status=DealStatus.DRAFT,
        )
        self.db.add(deal)
        await self.db.flush()
        await self.db.refresh(deal)

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
        """Cancel deal (sets status to CANCELLED, does not delete)"""
        if deal.status in [DealStatus.CLOSED, DealStatus.CANCELLED]:
            raise ValueError("Deal already closed or cancelled")

        # TODO: Handle refunds if payments made

        deal.status = DealStatus.CANCELLED
        await self.db.flush()
        await self.db.refresh(deal)

        return deal

    async def delete(self, deal: Deal) -> Deal:
        """Soft delete a deal (archive instead of physical delete)

        Only draft deals can be deleted. Deals with payments must be cancelled instead.
        """
        if deal.status != DealStatus.DRAFT:
            raise ValueError("Only draft deals can be deleted. Use cancel() for other deals.")

        if deal.is_deleted:
            raise ValueError("Deal is already deleted")

        deal.soft_delete()
        await self.db.flush()
        await self.db.refresh(deal)

        return deal

    async def restore(self, deal: Deal) -> Deal:
        """Restore a soft-deleted deal"""
        if not deal.is_deleted:
            raise ValueError("Deal is not deleted")

        deal.restore()
        await self.db.flush()
        await self.db.refresh(deal)

        return deal

    def _validate_transition(self, deal: Deal, new_status: DealStatus) -> None:
        """Validate state transition is allowed"""
        allowed = VALID_TRANSITIONS.get(deal.status, set())
        if new_status not in allowed:
            raise ValueError(
                f"Invalid transition: {deal.status.value} -> {new_status.value}. "
                f"Allowed: {[s.value for s in allowed]}"
            )

    async def transition_to_signed(self, deal: Deal) -> Deal:
        """Transition deal to SIGNED after all signatures collected"""
        self._validate_transition(deal, DealStatus.SIGNED)
        deal.status = DealStatus.SIGNED
        await self.db.flush()
        return deal

    async def transition_to_payment_pending(self, deal: Deal) -> Deal:
        """Transition deal to PAYMENT_PENDING when payment is initiated"""
        self._validate_transition(deal, DealStatus.PAYMENT_PENDING)
        deal.status = DealStatus.PAYMENT_PENDING
        await self.db.flush()
        return deal

    async def transition_to_in_progress(self, deal: Deal) -> Deal:
        """Transition deal to IN_PROGRESS after successful payment"""
        self._validate_transition(deal, DealStatus.IN_PROGRESS)
        deal.status = DealStatus.IN_PROGRESS
        await self.db.flush()
        return deal

    async def transition_to_closed(self, deal: Deal) -> Deal:
        """Transition deal to CLOSED when completed"""
        self._validate_transition(deal, DealStatus.CLOSED)
        deal.status = DealStatus.CLOSED
        await self.db.flush()
        return deal

