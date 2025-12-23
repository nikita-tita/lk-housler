"""User endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    User as UserSchema,
    UserProfileCreate,
    UserProfileUpdate,
    UserProfile as UserProfileSchema,
)
from app.services.user.service import UserService

router = APIRouter()


@router.get("/me", response_model=UserSchema)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user info"""
    user_service = UserService(db)
    user = await user_service.get_by_id(current_user.id)
    return user


@router.post("/me/profile", response_model=UserProfileSchema)
async def create_profile(
    profile_in: UserProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create user profile"""
    user_service = UserService(db)
    
    if current_user.profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile already exists"
        )
    
    profile = await user_service.create_profile(current_user, profile_in)
    return profile


@router.put("/me/profile", response_model=UserProfileSchema)
async def update_profile(
    profile_in: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    user_service = UserService(db)
    
    if not current_user.profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    profile = await user_service.update_profile(current_user.profile, profile_in)
    return profile

