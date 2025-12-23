"""User service implementation"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User, UserProfile, UserStatus
from app.schemas.user import UserCreate, UserUpdate, UserProfileCreate, UserProfileUpdate


class UserService:
    """User service"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_id(self, user_id: UUID) -> Optional[User]:
        """Get user by ID"""
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.profile))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_phone(self, phone: str) -> Optional[User]:
        """Get user by phone"""
        stmt = (
            select(User)
            .where(User.phone == phone)
            .options(selectinload(User.profile))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def create(self, user_in: UserCreate) -> User:
        """Create new user"""
        user = User(
            phone=user_in.phone,
            email=user_in.email,
            status=UserStatus.PENDING,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user
    
    async def update(self, user: User, user_in: UserUpdate) -> User:
        """Update user"""
        update_data = user_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await self.db.flush()
        await self.db.refresh(user)
        return user
    
    async def create_profile(
        self, 
        user: User, 
        profile_in: UserProfileCreate
    ) -> UserProfile:
        """Create user profile"""
        profile = UserProfile(
            user_id=user.id,
            **profile_in.model_dump()
        )
        self.db.add(profile)
        await self.db.flush()
        await self.db.refresh(profile)
        return profile
    
    async def update_profile(
        self,
        profile: UserProfile,
        profile_in: UserProfileUpdate
    ) -> UserProfile:
        """Update user profile"""
        update_data = profile_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)
        
        await self.db.flush()
        await self.db.refresh(profile)
        return profile

