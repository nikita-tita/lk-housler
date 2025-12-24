"""Document service implementation"""

from datetime import datetime
from typing import Optional
from uuid import UUID
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, ContractTemplate, DocumentStatus
from app.models.deal import Deal
from app.services.document.generator import DocumentGenerator, ContractTemplates
from app.services.storage.service import StorageService


class DocumentService:
    """Document service"""
    
    def __init__(self, db: AsyncSession, storage: Optional[StorageService] = None):
        self.db = db
        self.storage = storage or StorageService()
        self.generator = DocumentGenerator()
    
    async def generate_contract(self, deal: Deal) -> Document:
        """Generate contract document for deal"""
        # Prepare context
        context = await self._prepare_contract_context(deal)
        
        # Get template
        template_html = ContractTemplates.get_template(deal.type.value)
        
        # Render HTML
        rendered_html = self.generator.render_template(template_html, context)
        
        # Generate PDF
        pdf_bytes = self.generator.html_to_pdf(rendered_html)
        
        # Compute hash
        doc_hash = self.generator.compute_hash(pdf_bytes)
        
        # Upload to storage
        file_key = f"contracts/{deal.id}/v1.pdf"
        file_url = await self.storage.upload(file_key, pdf_bytes, "application/pdf")
        
        # Create document record
        document = Document(
            deal_id=deal.id,
            version_no=1,
            status=DocumentStatus.GENERATED,
            file_url=file_url,
            document_hash=doc_hash,
        )
        self.db.add(document)
        await self.db.flush()
        await self.db.refresh(document)
        
        return document
    
    async def _prepare_contract_context(self, deal: Deal) -> dict:
        """Prepare context for contract rendering"""
        # Get parties if available (full deal flow)
        parties = getattr(deal, 'parties', None) or []
        client_party = next((p for p in parties if str(p.party_role) == "client"), None)
        executor_party = next((p for p in parties if str(p.party_role) == "executor"), None)

        # Get terms if available (full deal flow)
        terms = getattr(deal, 'terms', None)

        # Payment plan rows (only if terms exist)
        payment_plan_rows = ""
        if terms and terms.payment_plan:
            for idx, step in enumerate(terms.payment_plan, 1):
                amount = step.get("amount", 0)
                trigger = step.get("trigger", "immediate")
                payment_plan_rows += f"""
                <tr>
                    <td>Платеж {idx}</td>
                    <td>{amount} руб.</td>
                    <td>{trigger}</td>
                </tr>
                """
        else:
            # Simplified deal - single payment
            commission = deal.commission_agent or 0
            payment_plan_rows = f"""
            <tr>
                <td>Платеж 1</td>
                <td>{commission:,.0f} руб.</td>
                <td>При подписании</td>
            </tr>
            """

        # Determine commission amount
        if terms:
            commission_total = f"{terms.commission_total:,.2f}"
        else:
            commission_total = f"{deal.commission_agent or 0:,.0f}"

        # Determine deal type label
        deal_type_label = {
            "secondary_buy": "Покупка вторичного жилья",
            "secondary_sell": "Продажа вторичного жилья",
            "newbuild_booking": "Бронирование новостройки",
        }.get(str(deal.type.value) if hasattr(deal.type, 'value') else str(deal.type), str(deal.type))

        context = {
            "contract_date": datetime.now().strftime("%d.%m.%Y"),
            "deal_type": deal_type_label,
            "property_address": deal.property_address or "не указан",
            "client_name": client_party.display_name_snapshot if client_party else (deal.client_name or "Клиент"),
            "client_phone": client_party.phone_snapshot if client_party else (deal.client_phone or ""),
            "executor_name": executor_party.display_name_snapshot if executor_party else "Исполнитель",
            "executor_inn": "не указан",  # TODO: get from Organization/User
            "commission_total": commission_total,
            "payment_plan_rows": payment_plan_rows,
            "document_hash": "generating...",  # Will be updated after generation
        }

        return context
    
    async def get_by_id(self, document_id: UUID) -> Optional[Document]:
        """Get document by ID"""
        stmt = select(Document).where(Document.id == document_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_deal_documents(self, deal_id: UUID) -> list[Document]:
        """Get all documents for deal"""
        stmt = (
            select(Document)
            .where(Document.deal_id == deal_id)
            .order_by(Document.version_no.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

