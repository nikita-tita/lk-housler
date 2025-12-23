"""Signature service implementation"""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Signature, Document, DocumentStatus, SignatureMethod
from app.models.deal import DealParty
from app.services.auth.otp import OTPService
from app.services.sms.provider import get_sms_provider


class SignatureService:
    """Signature service (ПЭП)"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.otp_service = OTPService(db, get_sms_provider())
    
    async def request_signature(
        self,
        document: Document,
        party: DealParty,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Signature:
        """Request signature from party"""
        # Check if document is ready for signing
        if document.status not in [DocumentStatus.GENERATED, DocumentStatus.SENT]:
            raise ValueError("Document is not ready for signing")
        
        # Check if already signed
        existing = await self._get_party_signature(document.id, party.id)
        if existing and existing.signed_at:
            raise ValueError("Party has already signed this document")
        
        # Send OTP
        phone = party.phone_snapshot
        if not phone:
            raise ValueError("Party phone number not available")
        
        otp_session = await self.otp_service.send_otp(
            phone,
            purpose="signature",
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Create or update signature record
        if existing:
            signature = existing
            signature.otp_request_id = otp_session.id
        else:
            signature = Signature(
                document_id=document.id,
                signer_party_id=party.id,
                method=SignatureMethod.PEP_SMS,
                phone=phone,
                otp_request_id=otp_session.id,
            )
            self.db.add(signature)
        
        await self.db.flush()
        await self.db.refresh(signature)
        
        # Update document status
        if document.status == DocumentStatus.GENERATED:
            document.status = DocumentStatus.SENT
            await self.db.flush()
        
        return signature
    
    async def verify_and_sign(
        self,
        document: Document,
        party: DealParty,
        otp_code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        consent_clicked_at: Optional[datetime] = None
    ) -> Signature:
        """Verify OTP and create signature"""
        # Get signature record
        signature = await self._get_party_signature(document.id, party.id)
        if not signature:
            raise ValueError("Signature request not found")
        
        if signature.signed_at:
            raise ValueError("Already signed")
        
        # Verify OTP
        phone = party.phone_snapshot
        verified = await self.otp_service.verify_otp(phone, otp_code, "signature")
        
        if not verified:
            raise ValueError("Invalid OTP code")
        
        # Create evidence
        evidence = {
            "ip": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow().isoformat(),
            "document_hash": document.document_hash,
            "consent_clicked_at": consent_clicked_at.isoformat() if consent_clicked_at else None,
            "otp_verified": True,
            "phone": phone,
        }
        
        # Update signature
        signature.signed_at = datetime.utcnow()
        signature.evidence = evidence
        
        await self.db.flush()
        
        # Check if all required signatures are collected
        await self._check_document_fully_signed(document)
        
        await self.db.refresh(signature)
        return signature
    
    async def _get_party_signature(
        self,
        document_id: UUID,
        party_id: UUID
    ) -> Optional[Signature]:
        """Get signature by document and party"""
        stmt = select(Signature).where(
            Signature.document_id == document_id,
            Signature.signer_party_id == party_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def _check_document_fully_signed(self, document: Document) -> bool:
        """Check if all required signatures are collected"""
        # Get all signatures for this document
        stmt = select(Signature).where(Signature.document_id == document.id)
        result = await self.db.execute(stmt)
        signatures = list(result.scalars().all())
        
        # Count required vs signed
        from app.models.deal import Deal
        stmt_deal = select(Deal).where(Deal.id == document.deal_id)
        result_deal = await self.db.execute(stmt_deal)
        deal = result_deal.scalar_one()
        
        required_parties = [p for p in deal.parties if p.signing_required]
        signed_count = sum(1 for s in signatures if s.signed_at is not None)
        
        if signed_count >= len(required_parties):
            document.status = DocumentStatus.SIGNED
            await self.db.flush()
            return True
        
        return False
    
    async def get_document_signatures(self, document_id: UUID) -> list[Signature]:
        """Get all signatures for document"""
        stmt = select(Signature).where(Signature.document_id == document_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

