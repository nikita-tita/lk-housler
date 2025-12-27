"""Document service implementation"""

from datetime import datetime
from typing import Optional
from uuid import UUID
import json
import random
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, ContractTemplate, DocumentStatus
from app.models.deal import Deal
from app.services.document.generator import DocumentGenerator, ContractTemplates
from app.services.storage.service import StorageService
from app.core.config import settings


def number_to_words_ru(n: int) -> str:
    """Convert number to Russian words (simplified version for common amounts)"""
    if n == 0:
        return "ноль рублей"

    units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]
    teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
             "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
    tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят",
            "шестьдесят", "семьдесят", "восемьдесят", "девяносто"]
    hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот",
                "шестьсот", "семьсот", "восемьсот", "девятьсот"]

    def get_form(n, forms):
        """Get correct Russian word form based on number"""
        n = abs(n) % 100
        if 10 < n < 20:
            return forms[2]
        n = n % 10
        if n == 1:
            return forms[0]
        if 2 <= n <= 4:
            return forms[1]
        return forms[2]

    result = []

    # Millions
    millions = n // 1000000
    if millions:
        if millions == 1:
            result.append("один миллион")
        elif millions == 2:
            result.append("два миллиона")
        else:
            result.append(f"{millions} " + get_form(millions, ["миллион", "миллиона", "миллионов"]))

    # Thousands
    thousands = (n % 1000000) // 1000
    if thousands:
        if thousands == 1:
            result.append("одна тысяча")
        elif thousands == 2:
            result.append("две тысячи")
        elif 3 <= thousands <= 4:
            result.append(f"{units[thousands] if thousands < 10 else thousands} тысячи")
        else:
            result.append(f"{thousands} " + get_form(thousands, ["тысяча", "тысячи", "тысяч"]))

    # Hundreds, tens, units
    remainder = n % 1000
    if remainder:
        h = remainder // 100
        if h:
            result.append(hundreds[h])

        t = (remainder % 100) // 10
        u = remainder % 10

        if t == 1:
            result.append(teens[u])
        else:
            if t:
                result.append(tens[t])
            if u:
                result.append(units[u])

    words = " ".join(result)
    rubles_form = get_form(n, ["рубль", "рубля", "рублей"])

    return f"{words} {rubles_form}".strip()


class DocumentService:
    """Document service"""

    def __init__(self, db: AsyncSession, storage: Optional[StorageService] = None):
        self.db = db
        self.storage = storage or StorageService()
        self.generator = DocumentGenerator()

    def _validate_deal_for_contract(self, deal: Deal) -> None:
        """Validate deal has required data for contract generation"""
        errors = []

        # Check client info
        parties = getattr(deal, 'parties', None) or []
        client_party = next((p for p in parties if str(p.party_role) == "client"), None)

        client_name = None
        if client_party:
            client_name = client_party.display_name_snapshot
        elif deal.client_name:
            client_name = deal.client_name

        if not client_name or client_name.strip() == "":
            errors.append("Client name is required")

        # Check property address
        if not deal.property_address or deal.property_address.strip() == "":
            errors.append("Property address is required")

        # Check commission
        terms = getattr(deal, 'terms', None)
        commission = None
        if terms and terms.commission_total:
            commission = terms.commission_total
        elif deal.commission_agent:
            commission = deal.commission_agent

        if not commission or commission <= 0:
            errors.append("Commission amount is required")

        if errors:
            raise ValueError(f"Cannot generate contract: {'; '.join(errors)}")

    async def generate_contract(self, deal: Deal) -> Document:
        """Generate contract document for deal"""
        # Validate required data before generation
        self._validate_deal_for_contract(deal)

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
    
    def _generate_contract_number(self, deal: Deal) -> str:
        """Generate unique contract number"""
        year = datetime.now().year
        # Use last 6 chars of deal UUID for uniqueness
        deal_suffix = str(deal.id).replace("-", "")[-6:].upper()
        return f"ДУ-{year}-{deal_suffix}"

    async def _prepare_contract_context(self, deal: Deal) -> dict:
        """Prepare context for contract rendering"""
        # Get parties if available (full deal flow)
        parties = getattr(deal, 'parties', None) or []
        client_party = next((p for p in parties if str(p.party_role) == "client"), None)
        executor_party = next((p for p in parties if str(p.party_role) == "executor"), None)

        # Get terms if available (full deal flow)
        terms = getattr(deal, 'terms', None)

        # Determine commission amount (as number)
        if terms and terms.commission_total:
            commission_amount = int(terms.commission_total)
        else:
            commission_amount = int(deal.commission_agent or 0)

        # Payment plan rows
        payment_plan_rows = ""
        if terms and terms.payment_plan:
            for idx, step in enumerate(terms.payment_plan, 1):
                amount = step.get("amount", 0)
                trigger_label = {
                    "immediate": "При подписании договора",
                    "after_viewing": "После показа объекта",
                    "after_deal": "После регистрации сделки",
                    "after_keys": "После передачи ключей",
                }.get(step.get("trigger", "immediate"), step.get("trigger", ""))
                payment_plan_rows += f"""
                <tr>
                    <td>Этап {idx}</td>
                    <td>{amount:,.0f}</td>
                    <td>{trigger_label}</td>
                </tr>
                """
        else:
            # Simplified deal - single payment
            payment_plan_rows = f"""
            <tr>
                <td>Этап 1</td>
                <td>{commission_amount:,.0f}</td>
                <td>При подписании договора</td>
            </tr>
            """

        # Commission formatted
        commission_total = f"{commission_amount:,.0f}".replace(",", " ")
        commission_words = number_to_words_ru(commission_amount)

        # Deal type label
        deal_type_label = {
            "secondary_buy": "Покупка вторичного жилья",
            "secondary_sell": "Продажа вторичного жилья",
            "newbuild_booking": "Бронирование новостройки",
        }.get(str(deal.type.value) if hasattr(deal.type, 'value') else str(deal.type), str(deal.type))

        # Contract number
        contract_number = self._generate_contract_number(deal)

        # Client info
        client_name = deal.client_name or "Клиент"
        client_phone = deal.client_phone or ""
        if client_party:
            client_name = client_party.display_name_snapshot
            client_phone = client_party.phone_snapshot or client_phone

        # Executor info (from settings or party)
        executor_name = getattr(settings, 'COMPANY_NAME', 'Исполнитель')
        executor_inn = getattr(settings, 'COMPANY_INN', 'не указан') or 'не указан'
        executor_kpp = getattr(settings, 'COMPANY_KPP', '') or ''
        executor_ogrn = getattr(settings, 'COMPANY_OGRN', '') or ''
        executor_address = getattr(settings, 'COMPANY_ADDRESS', '') or ''
        executor_phone = getattr(settings, 'COMPANY_PHONE', '') or ''
        executor_email = getattr(settings, 'COMPANY_EMAIL', '') or ''

        # Bank details
        bank_name = getattr(settings, 'COMPANY_BANK_NAME', '') or ''
        bank_bik = getattr(settings, 'COMPANY_BANK_BIK', '') or ''
        bank_account = getattr(settings, 'COMPANY_BANK_ACCOUNT', '') or ''
        bank_corr = getattr(settings, 'COMPANY_BANK_CORR', '') or ''

        # Build bank details block (only if filled)
        executor_bank_block = ""
        if bank_name and bank_account:
            executor_bank_block = f"""
                <div class="bank-details">
                    <p><strong>Банковские реквизиты:</strong></p>
                    <p>Банк: {bank_name}</p>
                    <p>БИК: {bank_bik}</p>
                    <p>Р/с: {bank_account}</p>
                    <p>К/с: {bank_corr}</p>
                </div>
            """

        if executor_party:
            executor_name = executor_party.display_name_snapshot

        context = {
            # Contract info
            "contract_number": contract_number,
            "contract_date": datetime.now().strftime("%d.%m.%Y"),

            # Deal info
            "deal_type": deal_type_label,
            "property_address": deal.property_address or "не указан",

            # Client info
            "client_name": client_name,
            "client_phone": client_phone,

            # Executor info (full requisites)
            "executor_name": executor_name,
            "executor_inn": executor_inn,
            "executor_kpp": executor_kpp or "-",
            "executor_ogrn": executor_ogrn or "-",
            "executor_address": executor_address or "не указан",
            "executor_phone": executor_phone,
            "executor_email": executor_email or "-",
            "executor_bank_block": executor_bank_block,

            # Financial info
            "commission_total": commission_total,
            "commission_words": commission_words,
            "payment_plan_rows": payment_plan_rows,

            # Document hash (placeholder, will be replaced after PDF generation)
            "document_hash": "generating...",
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

