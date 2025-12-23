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
        # Получаем данные из deal
        client_party = next((p for p in deal.parties if p.party_role == "client"), None)
        executor_party = next((p for p in deal.parties if p.party_role == "executor"), None)
        
        # Формируем payment plan rows (HTML)
        payment_plan_rows = ""
        for idx, step in enumerate(deal.terms.payment_plan, 1):
            amount = step.get("amount", 0)
            trigger = step.get("trigger", "immediate")
            payment_plan_rows += f"""
            <tr>
                <td>Платеж {idx}</td>
                <td>{amount} руб.</td>
                <td>{trigger}</td>
            </tr>
            """
        
        context = {
            "contract_date": datetime.now().strftime("%d.%m.%Y"),
            "deal_type": "Покупка вторичного жилья" if deal.type == "secondary_buy" else "Продажа",
            "property_address": deal.property_address or "не указан",
            "client_name": client_party.display_name_snapshot if client_party else "Клиент",
            "client_phone": client_party.phone_snapshot if client_party else "",
            "executor_name": executor_party.display_name_snapshot if executor_party else "Исполнитель",
            "executor_inn": "не указан",  # TODO: получить из Organization/User
            "commission_total": f"{deal.terms.commission_total:,.2f}",
            "payment_plan_rows": payment_plan_rows,
            "document_hash": "generating...",  # Будет обновлено после генерации
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

