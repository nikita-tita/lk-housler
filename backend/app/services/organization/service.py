"""Organization service implementation"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.organization import (
    Organization,
    OrganizationMember,
    PayoutAccount,
    OrganizationStatus,
    KYCStatus,
)
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationMemberCreate,
    PayoutAccountCreate,
)


class OrganizationService:
    """Organization service"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, org_id: UUID) -> Optional[Organization]:
        """Get organization by ID"""
        stmt = select(Organization).where(Organization.id == org_id).options(selectinload(Organization.members))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_inn(self, inn: str) -> Optional[Organization]:
        """Get organization by INN"""
        stmt = select(Organization).where(Organization.inn == inn)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, org_in: OrganizationCreate, creator: User) -> Organization:
        """Create new organization"""
        # Check if INN already exists
        existing = await self.get_by_inn(org_in.inn)
        if existing:
            raise ValueError("Organization with this INN already exists")

        org = Organization(
            **org_in.model_dump(),
            status=OrganizationStatus.PENDING,
            kyc_status=KYCStatus.PENDING,
        )
        self.db.add(org)
        await self.db.flush()

        # Add creator as admin
        member = OrganizationMember(
            org_id=org.id,
            user_id=creator.id,
            role="admin",
            is_active=True,
        )
        self.db.add(member)
        await self.db.flush()

        await self.db.refresh(org)
        return org

    async def update(self, org: Organization, org_in: OrganizationUpdate) -> Organization:
        """Update organization"""
        update_data = org_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(org, field, value)

        await self.db.flush()
        await self.db.refresh(org)
        return org

    async def list_user_organizations(self, user: User) -> List[Organization]:
        """List organizations where user is a member"""
        stmt = (
            select(Organization)
            .join(OrganizationMember)
            .where(OrganizationMember.user_id == user.id, OrganizationMember.is_active == True)  # noqa
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add_member(self, org: Organization, member_in: OrganizationMemberCreate) -> OrganizationMember:
        """Add member to organization"""
        # Check if already a member
        stmt = select(OrganizationMember).where(
            OrganizationMember.org_id == org.id, OrganizationMember.user_id == member_in.user_id
        )
        result = await self.db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            if existing.is_active:
                raise ValueError("User is already a member")
            # Reactivate
            existing.is_active = True
            existing.role = member_in.role
            await self.db.flush()
            return existing

        member = OrganizationMember(org_id=org.id, **member_in.model_dump())
        self.db.add(member)
        await self.db.flush()
        await self.db.refresh(member)
        return member

    async def create_payout_account(
        self, owner_type: str, owner_id: UUID, account_in: PayoutAccountCreate
    ) -> PayoutAccount:
        """Create payout account"""
        # If default, unset other defaults
        if account_in.is_default:
            stmt = select(PayoutAccount).where(
                PayoutAccount.owner_type == owner_type,
                PayoutAccount.owner_id == owner_id,
                PayoutAccount.is_default == True,  # noqa
            )
            result = await self.db.execute(stmt)
            for acc in result.scalars():
                acc.is_default = False

        account = PayoutAccount(owner_type=owner_type, owner_id=owner_id, **account_in.model_dump())
        self.db.add(account)
        await self.db.flush()
        await self.db.refresh(account)
        return account
