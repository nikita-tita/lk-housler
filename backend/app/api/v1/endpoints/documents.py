"""Document endpoints"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_deal_access
from app.db.session import get_db
from app.models.user import User
from app.services.document.service import DocumentService
from app.services.deal.service import DealService

router = APIRouter()


@router.post("/deals/{deal_id}/generate")
async def generate_contract(
    deal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate contract for deal"""
    deal_service = DealService(db)
    deal = await deal_service.get_by_id(deal_id)
    
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )

    require_deal_access(deal, current_user)

    doc_service = DocumentService(db)
    
    try:
        document = await doc_service.generate_contract(deal)
        return {
            "id": str(document.id),
            "deal_id": str(deal.id),
            "version": document.version_no,
            "status": document.status,
            "file_url": document.file_url,
            "hash": document.document_hash
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate document: {str(e)}"
        )


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get document metadata"""
    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    return {
        "id": str(document.id),
        "deal_id": str(document.deal_id),
        "version": document.version_no,
        "status": document.status,
        "file_url": document.file_url,
        "hash": document.document_hash,
        "created_at": document.created_at.isoformat()
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Redirect to document download URL"""
    doc_service = DocumentService(db)
    document = await doc_service.get_by_id(document_id)

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    deal_service = DealService(db)
    deal = await deal_service.get_by_id(document.deal_id)
    if deal:
        require_deal_access(deal, current_user)

    return RedirectResponse(url=document.file_url)


@router.post("/{document_id}/sign")
async def sign_document(document_id: str):
    """Sign document (TODO: будет реализовано в Signature Service)"""
    return {"message": f"Sign document {document_id} - TODO in Signature Service"}

