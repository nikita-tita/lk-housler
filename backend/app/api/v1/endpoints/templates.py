"""Template management API endpoints"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.document import TemplateStatus
from app.schemas.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateListItem,
    TemplateListResponse,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateValidationResponse,
)
from app.services.template.service import TemplateService


router = APIRouter()


# =========================================================================
# List & Get
# =========================================================================

@router.get("", response_model=TemplateListResponse)
async def list_templates(
    code: Optional[str] = Query(None, description="Filter by code"),
    status: Optional[TemplateStatus] = Query(None, description="Filter by status"),
    active_only: bool = Query(False, description="Only active templates"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List contract templates"""
    service = TemplateService(db)
    templates, total = await service.list_templates(
        code=code,
        status=status,
        active_only=active_only,
        limit=limit,
        offset=offset
    )
    return TemplateListResponse(
        items=[TemplateListItem.model_validate(t) for t in templates],
        total=total
    )


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get template by ID"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    return TemplateResponse.model_validate(template)


# =========================================================================
# Create & Update (Admin only)
# =========================================================================

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: TemplateCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create new template (Admin only)"""
    service = TemplateService(db)

    template = await service.create(
        code=data.code,
        template_type=data.type,
        name=data.name,
        template_body=data.template_body,
        placeholders_schema=data.placeholders_schema,
        version=data.version,
        description=data.description,
        legal_basis=data.legal_basis,
        effective_from=data.effective_from,
        created_by=current_user
    )

    await db.commit()
    return TemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    data: TemplateUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update template (Admin only, draft templates only)"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.update(
            template,
            name=data.name,
            description=data.description,
            template_body=data.template_body,
            placeholders_schema=data.placeholders_schema,
            legal_basis=data.legal_basis,
            effective_from=data.effective_from
        )
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete template (Admin only, draft templates only)"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        await service.delete(template)
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =========================================================================
# Workflow Actions
# =========================================================================

@router.post("/{template_id}/submit-for-review", response_model=TemplateResponse)
async def submit_for_review(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Submit template for review"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.submit_for_review(template)
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{template_id}/approve", response_model=TemplateResponse)
async def approve_template(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Approve template (requires admin role)"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.approve(template, current_user)
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{template_id}/publish", response_model=TemplateResponse)
async def publish_template(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Publish approved template"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.publish(template)
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{template_id}/activate", response_model=TemplateResponse)
async def activate_template(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Activate template (deactivates others with same code)"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.activate(template)
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{template_id}/archive", response_model=TemplateResponse)
async def archive_template(
    template_id: UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Archive template"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    try:
        template = await service.archive(template)
        await db.commit()
        return TemplateResponse.model_validate(template)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# =========================================================================
# Validation & Preview
# =========================================================================

@router.post("/{template_id}/validate", response_model=TemplateValidationResponse)
async def validate_template(
    template_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Validate template HTML and placeholders"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    result = service.validate_template(
        template.template_body,
        template.placeholders_schema
    )

    return TemplateValidationResponse(**result)


@router.post("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: UUID,
    data: TemplatePreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Preview template with test data"""
    service = TemplateService(db)
    template = await service.get_by_id(template_id)

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found"
        )

    result = service.preview_template(
        template.template_body,
        data.test_data
    )

    return TemplatePreviewResponse(**result)


# =========================================================================
# Seed (Admin only)
# =========================================================================

@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed_templates(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Seed database with hardcoded templates (Admin only)"""
    service = TemplateService(db)
    created = await service.seed_hardcoded_templates()
    await db.commit()

    return {
        "message": f"Created {len(created)} templates",
        "templates": [t.code for t in created]
    }
