"""Pydantic schemas for split adjustments"""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class SplitAdjustmentCreate(BaseModel):
    """Schema for creating a split adjustment request"""

    new_split: Dict[int, Decimal] = Field(
        ...,
        description="New split percentages by user_id",
        json_schema_extra={"example": {"123": 50, "456": 50}}
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=1000,
        description="Reason for the adjustment"
    )

    @field_validator('new_split')
    @classmethod
    def validate_split_totals(cls, v: Dict[int, Decimal]) -> Dict[int, Decimal]:
        """Ensure split percentages sum to 100"""
        if not v:
            raise ValueError("Split must have at least one recipient")
        total = sum(v.values())
        if total != Decimal("100"):
            raise ValueError(f"Split percentages must sum to 100, got {total}")
        for user_id, percent in v.items():
            if percent < 0:
                raise ValueError(f"Percentage for user {user_id} cannot be negative")
            if percent > 100:
                raise ValueError(f"Percentage for user {user_id} cannot exceed 100")
        return v


class ApprovalInfo(BaseModel):
    """Info about an approval or rejection"""

    user_id: int
    timestamp: datetime
    reason: Optional[str] = None


class SplitAdjustmentResponse(BaseModel):
    """Schema for split adjustment response"""

    id: UUID
    deal_id: UUID
    requested_by_user_id: int

    old_split: Dict[str, Decimal]
    new_split: Dict[str, Decimal]
    reason: str
    status: str

    required_approvers: List[int]
    approvals: List[ApprovalInfo]
    rejections: List[ApprovalInfo]

    expires_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SplitAdjustmentApprove(BaseModel):
    """Schema for approving a split adjustment"""

    pass  # No additional data needed


class SplitAdjustmentReject(BaseModel):
    """Schema for rejecting a split adjustment"""

    reason: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Reason for rejection"
    )


class SplitAdjustmentListResponse(BaseModel):
    """List of split adjustments"""

    items: List[SplitAdjustmentResponse]
    total: int
