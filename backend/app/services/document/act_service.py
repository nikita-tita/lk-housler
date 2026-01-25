"""Act of Completed Services generation and signing service (UC-3.2)"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, SigningToken, DocumentStatus
from app.models.deal import Deal
from app.services.document.generator import DocumentGenerator, ContractTemplates
from app.services.document.service import number_to_words_ru
from app.services.storage.service import StorageService
from app.core.config import settings
from app.core.audit import log_audit_event, AuditEvent

logger = logging.getLogger(__name__)


class ActGenerationService:
    """
    UC-3.2: Service for generating Act of Completed Services (Акт выполненных работ)
    and creating signing tokens for client confirmation.
    """

    def __init__(self, db: AsyncSession, storage: Optional[StorageService] = None):
        self.db = db
        self.storage = storage or StorageService()
        self.generator = DocumentGenerator()

    async def generate_act_for_deal(self, deal: Deal) -> Document:
        """
        Generate Act of Completed Services document for a deal.

        Args:
            deal: The deal to generate act for

        Returns:
            Generated Document record

        Raises:
            ValueError: If deal data is incomplete
        """
        # Validate deal has required data
        self._validate_deal_for_act(deal)

        try:
            # Prepare context for template
            context = self._prepare_act_context(deal)

            # Get Act template
            template_html = ContractTemplates.get_template("act")

            # Render HTML
            rendered_html = self.generator.render_template(template_html, context)

            # Generate PDF
            pdf_bytes = self.generator.html_to_pdf(rendered_html)

            # Compute hash
            doc_hash = self.generator.compute_hash(pdf_bytes)

            # Update context with real hash and re-render
            context["document_hash"] = doc_hash
            rendered_html = self.generator.render_template(template_html, context)
            pdf_bytes = self.generator.html_to_pdf(rendered_html)

            # Upload to storage
            file_key = f"acts/{deal.id}/act_v1.pdf"
            file_url = await self.storage.upload(file_key, pdf_bytes, "application/pdf")

            # Create document record
            document = Document(
                deal_id=deal.id,
                version_no=1,
                status=DocumentStatus.GENERATED.value,
                file_url=file_url,
                document_hash=doc_hash,
            )
            self.db.add(document)
            await self.db.flush()
            await self.db.refresh(document)

            # Update deal with act_document_id
            deal.act_document_id = document.id

            # Audit log
            log_audit_event(
                event=AuditEvent.DOCUMENT_GENERATED,
                resource=f"deal:{deal.id}",
                details={
                    "document_id": str(document.id),
                    "document_type": "act",
                    "document_hash": doc_hash,
                },
                success=True,
            )

            logger.info(f"Generated Act for deal {deal.id}, document_id: {document.id}")

            return document

        except Exception as e:
            log_audit_event(
                event=AuditEvent.DOCUMENT_GENERATION_FAILED,
                resource=f"deal:{deal.id}",
                details={
                    "error": str(e),
                    "document_type": "act",
                },
                success=False,
            )
            raise

    async def create_signing_token(
        self,
        document: Document,
        phone: str,
        expires_days: int = 7,
    ) -> SigningToken:
        """
        Create a signing token for client to sign the Act.

        Args:
            document: The Act document to sign
            phone: Client's phone number for OTP
            expires_days: Token expiration in days

        Returns:
            SigningToken for public signing URL
        """
        # Generate secure random token
        token = secrets.token_urlsafe(16)[:20]  # Short but secure

        # Get client party from deal
        deal = await self._get_deal(document.deal_id)
        client_party = None
        if deal and deal.parties:
            for party in deal.parties:
                if str(party.party_role) == "client":
                    client_party = party
                    break

        if not client_party:
            raise ValueError("Client party not found for deal")

        signing_token = SigningToken(
            token=token,
            document_id=document.id,
            party_id=client_party.id,
            phone=phone,
            expires_at=datetime.utcnow() + timedelta(days=expires_days),
            used=False,
        )
        self.db.add(signing_token)
        await self.db.flush()
        await self.db.refresh(signing_token)

        logger.info(f"Created signing token for document {document.id}")

        return signing_token

    def get_signing_url(self, token: str) -> str:
        """
        Generate public signing URL for client.

        Args:
            token: The signing token

        Returns:
            Full URL for signing page
        """
        base_url = getattr(settings, "FRONTEND_URL", "https://lk.housler.ru")
        return f"{base_url}/sign/act/{token}"

    async def get_signing_token(self, token: str) -> Optional[SigningToken]:
        """
        Get signing token by token string.

        Args:
            token: The token string

        Returns:
            SigningToken if found and valid, None otherwise
        """
        stmt = select(SigningToken).where(
            SigningToken.token == token,
            SigningToken.expires_at > datetime.utcnow(),
            SigningToken.used == False,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def mark_token_used(self, signing_token: SigningToken) -> None:
        """Mark signing token as used"""
        signing_token.used = True
        signing_token.used_at = datetime.utcnow()
        await self.db.flush()

    def _validate_deal_for_act(self, deal: Deal) -> None:
        """Validate deal has required data for act generation"""
        errors = []

        if not deal.client_name and not deal.client_phone:
            errors.append("Client information is required")

        if not deal.property_address:
            errors.append("Property address is required")

        if not deal.commission_agent and (not deal.terms or not deal.terms.commission_total):
            errors.append("Commission amount is required")

        if errors:
            raise ValueError(f"Cannot generate Act: {'; '.join(errors)}")

    def _prepare_act_context(self, deal: Deal) -> dict:
        """Prepare context for Act template rendering"""
        # Get terms
        terms = getattr(deal, "terms", None)

        # Commission amount
        if terms and terms.commission_total:
            commission_amount = int(terms.commission_total)
        else:
            commission_amount = int(deal.commission_agent or 0)

        commission_total = f"{commission_amount:,.0f}".replace(",", " ")
        commission_words = number_to_words_ru(commission_amount)

        # Act number (based on deal ID and timestamp)
        year = datetime.now().year
        deal_suffix = str(deal.id).replace("-", "")[-6:].upper()
        act_number = f"АКТ-{year}-{deal_suffix}"

        # Contract number (reference to original contract)
        contract_number = f"ДУ-{year}-{deal_suffix}"

        # Client info
        client_name = deal.client_name or "Заказчик"
        client_phone = deal.client_phone or ""

        # Check parties for better info
        parties = getattr(deal, "parties", None) or []
        for party in parties:
            if str(party.party_role) == "client":
                client_name = party.display_name_snapshot or client_name
                client_phone = party.phone_snapshot or client_phone
                break

        # Executor info
        executor_name = getattr(settings, "COMPANY_NAME", "Исполнитель")
        executor_inn = getattr(settings, "COMPANY_INN", "не указан") or "не указан"
        executor_kpp = getattr(settings, "COMPANY_KPP", "") or ""
        executor_ogrn = getattr(settings, "COMPANY_OGRN", "") or ""

        # Service description based on deal type
        deal_type_key = deal.type.value if hasattr(deal.type, "value") else str(deal.type)
        service_descriptions = {
            "sale_buy": "Услуги по подбору и сопровождению приобретения объекта недвижимости",
            "sale_sell": "Услуги по продаже объекта недвижимости",
            "secondary_buy": "Услуги по подбору и сопровождению приобретения объекта недвижимости",
            "secondary_sell": "Услуги по продаже объекта недвижимости",
            "rent_tenant": "Услуги по подбору объекта недвижимости для аренды",
            "rent_landlord": "Услуги по сдаче объекта недвижимости в аренду",
            "newbuild_booking": "Услуги по бронированию квартиры в новостройке",
        }
        service_description = service_descriptions.get(
            deal_type_key,
            "Услуги по сопровождению сделки с недвижимостью"
        )

        # Deal result
        deal_result = "Сделка успешно завершена, услуги оказаны в полном объеме"

        # Contract date (use deal creation date)
        contract_date = deal.created_at.strftime("%d.%m.%Y") if deal.created_at else datetime.now().strftime("%d.%m.%Y")

        context = {
            # Act info
            "act_number": act_number,
            "act_date": datetime.now().strftime("%d.%m.%Y"),
            # Contract reference
            "contract_number": contract_number,
            "contract_date": contract_date,
            # Client info
            "client_name": client_name,
            "client_phone": client_phone,
            # Executor info
            "executor_name": executor_name,
            "executor_inn": executor_inn,
            "executor_kpp": executor_kpp or "-",
            "executor_ogrn": executor_ogrn or "-",
            # Service info
            "service_description": service_description,
            "property_address": deal.property_address or "не указан",
            "deal_result": deal_result,
            # Financial
            "commission_total": commission_total,
            "commission_words": commission_words,
            # Hash placeholder
            "document_hash": "generating...",
        }

        return context

    async def _get_deal(self, deal_id: UUID) -> Optional[Deal]:
        """Get deal by ID with parties loaded"""
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Deal)
            .where(Deal.id == deal_id)
            .options(selectinload(Deal.parties))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
