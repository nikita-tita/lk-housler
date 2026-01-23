"""Signature service implementation"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Signature, Document, SignatureMethod
from app.models.deal import Deal
from app.services.auth.otp import OTPService
from app.services.sms.provider import get_sms_provider


class SignatureService:
    """Signature service (PEP - simple electronic signature)"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.otp_service = OTPService(db, get_sms_provider())

    async def request_otp_for_signing(
        self, document_id: UUID, phone: str, ip_address: Optional[str] = None, user_agent: Optional[str] = None
    ) -> None:
        """Send OTP for document signing"""
        await self.otp_service.send_otp(
            phone=phone, purpose=f"sign_{document_id}", ip_address=ip_address, user_agent=user_agent
        )

    async def verify_and_sign(
        self,
        document: Document,
        party_id: UUID,
        phone: str,
        otp_code: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        signing_token: Optional[str] = None,
        consent_personal_data: bool = False,
        consent_pep: bool = False,
        geolocation: Optional[dict] = None,
    ) -> Signature:
        """Verify OTP and create signature"""
        # Check if already signed
        existing = await self._get_party_signature(document.id, party_id)
        if existing and existing.signed_at:
            raise ValueError("Party has already signed this document")

        # Verify OTP
        verified = await self.otp_service.verify_otp(phone=phone, code=otp_code, purpose=f"sign_{document.id}")

        if not verified:
            raise ValueError("Invalid OTP code")

        # Create evidence for legal compliance
        now = datetime.utcnow()
        evidence = {
            "ip": ip_address,
            "user_agent": user_agent,
            "timestamp": now.isoformat(),
            "document_hash": document.document_hash,
            "signing_token": signing_token,
            "consent_personal_data": consent_personal_data,
            "consent_pep": consent_pep,
            "otp_verified": True,
            "phone": phone,
            "geolocation": geolocation,  # Optional: {lat, lon, accuracy}
        }

        # Create or update signature record
        if existing:
            signature = existing
            signature.signed_at = now
            signature.evidence = evidence
        else:
            signature = Signature(
                document_id=document.id,
                signer_party_id=party_id,
                method=SignatureMethod.PEP_SMS,
                phone=phone,
                signed_at=now,
                evidence=evidence,
            )
            self.db.add(signature)

        await self.db.flush()

        # Check if all required signatures are collected
        await self.check_document_fully_signed(document)

        await self.db.refresh(signature)
        return signature

    async def _get_party_signature(self, document_id: UUID, party_id: UUID) -> Optional[Signature]:
        """Get signature by document and party"""
        stmt = select(Signature).where(Signature.document_id == document_id, Signature.signer_party_id == party_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def check_document_fully_signed(self, document: Document) -> bool:
        """Check if all required signatures are collected and update document/deal status"""
        # Get deal with parties
        stmt_deal = select(Deal).where(Deal.id == document.deal_id).options(selectinload(Deal.parties))
        result_deal = await self.db.execute(stmt_deal)
        deal = result_deal.scalar_one_or_none()

        if not deal:
            return False

        # Get required parties
        required_parties = [p for p in deal.parties if p.signing_required]
        required_party_ids = {p.id for p in required_parties}

        # Get all signatures for this document
        stmt_sigs = select(Signature).where(Signature.document_id == document.id, Signature.signed_at.isnot(None))
        result_sigs = await self.db.execute(stmt_sigs)
        signatures = list(result_sigs.scalars().all())

        # Check if all required parties have signed
        signed_party_ids = {s.signer_party_id for s in signatures}

        if required_party_ids.issubset(signed_party_ids):
            document.status = "signed"  # DocumentStatus.SIGNED as string

            # Transition deal to SIGNED status
            from app.services.deal.service import DealService

            deal_service = DealService(self.db)
            try:
                await deal_service.transition_to_signed(deal)
            except ValueError:
                # Deal may already be in a later state (e.g., payment started)
                pass

            await self.db.flush()
            return True

        return False

    async def get_document_signatures(self, document_id: UUID) -> list[Signature]:
        """Get all signatures for document"""
        stmt = select(Signature).where(Signature.document_id == document_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
