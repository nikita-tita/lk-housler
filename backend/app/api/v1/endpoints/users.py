"""User endpoints"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """Get current user info"""
    return current_user


# Note: User profile management is handled by agent.housler.ru
# lk.housler.ru only reads user data from the shared database
