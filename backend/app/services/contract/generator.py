"""Contract generation service for bank-split deals"""

import logging
import hashlib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List
from uuid import UUID
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contract import SignedContract, ContractSignature, ContractStatus
from app.models.document import ContractTemplate, TemplateType
from app.models.deal import Deal
from app.models.user import User

logger = logging.getLogger(__name__)


class ContractGenerationService:
    """
    Service for generating and managing bank-split contracts.

    Handles:
    - Contract number generation
    - Template rendering with deal data
    - Contract creation and signing workflow
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    def generate_contract_number(self) -> str:
        """Generate unique contract number"""
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        random_part = secrets.token_hex(3).upper()
        return f"BS-{timestamp}-{random_part}"

    async def get_template(
        self,
        template_type: TemplateType,
    ) -> Optional[ContractTemplate]:
        """Get active template by type"""
        stmt = select(ContractTemplate).where(
            ContractTemplate.type == template_type,
            ContractTemplate.active == True,
        ).order_by(ContractTemplate.created_at.desc())

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    def render_template(
        self,
        template: ContractTemplate,
        data: Dict[str, Any],
    ) -> str:
        """
        Render template HTML with provided data.

        Uses simple string replacement for placeholders like {{variable_name}}
        """
        html = template.template_body

        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"  # {{key}}
            html = html.replace(placeholder, str(value) if value else "")

        return html

    def build_contract_data(
        self,
        deal: Deal,
        agent_user: User,
    ) -> Dict[str, Any]:
        """Build contract data from deal and users"""
        return {
            # Deal info
            "deal_id": str(deal.id),
            "deal_date": deal.created_at.strftime("%d.%m.%Y"),
            "property_address": deal.property_address or "Не указан",
            "deal_price": f"{deal.price:,.2f}".replace(",", " ") if deal.price else "0.00",

            # Financial
            "commission_amount": f"{deal.commission_agent:,.2f}".replace(",", " ") if deal.commission_agent else "0.00",
            "commission_amount_raw": float(deal.commission_agent) if deal.commission_agent else 0,

            # Agent info
            "agent_name": f"{agent_user.first_name or ''} {agent_user.last_name or ''}".strip() or "Агент",
            "agent_phone": agent_user.phone or "",
            "agent_email": agent_user.email or "",

            # Client info
            "client_name": deal.client_name or "Не указан",
            "client_phone": deal.client_phone or "",
            "client_email": deal.payer_email or "",

            # Dates
            "current_date": datetime.utcnow().strftime("%d.%m.%Y"),
            "current_year": datetime.utcnow().strftime("%Y"),
        }

    async def generate_contract(
        self,
        deal: Deal,
        template_type: TemplateType,
        agent_user: User,
        additional_data: Optional[Dict[str, Any]] = None,
    ) -> SignedContract:
        """
        Generate a contract for a bank-split deal.

        Args:
            deal: The deal to generate contract for
            template_type: Type of contract template
            agent_user: Agent user
            additional_data: Additional data to include in contract

        Returns:
            Created SignedContract
        """
        # Get template
        template = await self.get_template(template_type)

        if not template:
            # Create a default template if none exists
            template = await self._create_default_template(template_type)

        # Build contract data
        contract_data = self.build_contract_data(deal, agent_user)
        if additional_data:
            contract_data.update(additional_data)

        # Render HTML
        html_content = self.render_template(template, contract_data)

        # Generate document hash
        document_hash = hashlib.sha256(html_content.encode()).hexdigest()

        # Determine required signers based on template type
        required_signers = self._determine_signers(deal, template_type)

        # Create contract
        contract = SignedContract(
            deal_id=deal.id,
            template_id=template.id,
            contract_number=self.generate_contract_number(),
            contract_type=template_type.value,
            status=ContractStatus.DRAFT.value,
            html_content=html_content,
            document_hash=document_hash,
            contract_data=contract_data,
            commission_amount=deal.commission_agent,
            required_signers=[
                {"user_id": s["user_id"], "role": s["role"], "signed_at": None}
                for s in required_signers
            ],
            generated_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=14),  # 14 days to sign
        )

        self.db.add(contract)
        await self.db.flush()

        # Create signature records for each required signer
        for signer in required_signers:
            signature = ContractSignature(
                contract_id=contract.id,
                user_id=signer["user_id"],
                signer_name=signer["name"],
                signer_role=signer["role"],
            )
            self.db.add(signature)

        await self.db.flush()

        logger.info(f"Generated contract {contract.contract_number} for deal {deal.id}")
        return contract

    def _determine_signers(
        self,
        deal: Deal,
        template_type: TemplateType,
    ) -> List[Dict[str, Any]]:
        """Determine who needs to sign based on template type"""
        signers = []

        if template_type == TemplateType.BANK_SPLIT_AGENT_AGREEMENT:
            # Agent agreement: signed by agent
            signers.append({
                "user_id": deal.agent_user_id,
                "role": "agent",
                "name": f"Агент"  # Will be enriched later
            })

        elif template_type == TemplateType.BANK_SPLIT_CLIENT_AGREEMENT:
            # Client agreement: signed by client (if registered)
            if deal.client_id:
                signers.append({
                    "user_id": deal.client_id,
                    "role": "client",
                    "name": deal.client_name or "Клиент"
                })

        elif template_type == TemplateType.BANK_SPLIT_AGENCY_AGREEMENT:
            # Agency agreement: signed by agency rep and agent
            signers.append({
                "user_id": deal.agent_user_id,
                "role": "agent",
                "name": "Агент"
            })
            # Agency signer would be added here based on org structure

        return signers

    async def _create_default_template(
        self,
        template_type: TemplateType,
    ) -> ContractTemplate:
        """Create a default template if none exists"""
        templates = {
            TemplateType.BANK_SPLIT_AGENT_AGREEMENT: {
                "code": "bank_split_agent",
                "name": "Договор оказания услуг (Bank-Split)",
                "body": """
                <html>
                <head><title>Договор {{contract_number}}</title></head>
                <body>
                <h1>ДОГОВОР ОКАЗАНИЯ УСЛУГ</h1>
                <p>Договор № {{contract_number}} от {{current_date}}</p>

                <h2>1. ПРЕДМЕТ ДОГОВОРА</h2>
                <p>Агент {{agent_name}} обязуется оказать услуги по сопровождению сделки
                с объектом недвижимости по адресу: {{property_address}}</p>

                <h2>2. СТОИМОСТЬ УСЛУГ</h2>
                <p>Стоимость услуг составляет: {{commission_amount}} руб.</p>

                <h2>3. КЛИЕНТ</h2>
                <p>{{client_name}}, телефон: {{client_phone}}</p>

                <h2>4. ПОДПИСИ СТОРОН</h2>
                <p>Агент: ______________________ / {{agent_name}}</p>
                </body>
                </html>
                """,
            },
            TemplateType.BANK_SPLIT_CLIENT_AGREEMENT: {
                "code": "bank_split_client",
                "name": "Согласие клиента (Bank-Split)",
                "body": """
                <html>
                <head><title>Согласие клиента</title></head>
                <body>
                <h1>СОГЛАСИЕ НА ОПЛАТУ УСЛУГ</h1>
                <p>Я, {{client_name}}, подтверждаю согласие на оплату услуг
                в размере {{commission_amount}} руб. по сделке {{deal_id}}</p>
                <p>Дата: {{current_date}}</p>
                <p>Подпись: ______________________</p>
                </body>
                </html>
                """,
            },
            TemplateType.BANK_SPLIT_AGENCY_AGREEMENT: {
                "code": "bank_split_agency",
                "name": "Соглашение с агентством (Bank-Split)",
                "body": """
                <html>
                <head><title>Соглашение об оказании услуг</title></head>
                <body>
                <h1>СОГЛАШЕНИЕ О РАСПРЕДЕЛЕНИИ КОМИССИИ</h1>
                <p>Соглашение № {{contract_number}} от {{current_date}}</p>
                <p>Объект: {{property_address}}</p>
                <p>Сумма комиссии: {{commission_amount}} руб.</p>
                </body>
                </html>
                """,
            },
        }

        data = templates.get(template_type, {
            "code": template_type.value,
            "name": f"Шаблон {template_type.value}",
            "body": "<html><body><p>Шаблон не определен</p></body></html>",
        })

        template = ContractTemplate(
            code=data["code"],
            type=template_type,
            version="1.0",
            name=data["name"],
            template_body=data["body"],
            placeholders_schema={},
            active=True,
        )

        self.db.add(template)
        await self.db.flush()

        return template

    async def sign_contract(
        self,
        contract_id: UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ContractSignature:
        """
        Sign a contract.

        Args:
            contract_id: Contract to sign
            user: User signing the contract
            ip_address: Client IP
            user_agent: Client user agent

        Returns:
            Updated signature record
        """
        # Get contract
        stmt = select(SignedContract).where(SignedContract.id == contract_id)
        result = await self.db.execute(stmt)
        contract = result.scalar_one_or_none()

        if not contract:
            raise ValueError(f"Contract {contract_id} not found")

        if contract.status in (ContractStatus.FULLY_SIGNED.value, ContractStatus.CANCELLED.value):
            raise ValueError(f"Contract is already {contract.status}")

        # Check expiry
        if contract.expires_at and datetime.utcnow() > contract.expires_at:
            contract.status = ContractStatus.EXPIRED.value
            await self.db.flush()
            raise ValueError("Contract has expired")

        # Find signature record
        stmt = select(ContractSignature).where(
            ContractSignature.contract_id == contract_id,
            ContractSignature.user_id == user.id,
        )
        result = await self.db.execute(stmt)
        signature = result.scalar_one_or_none()

        if not signature:
            raise ValueError("User is not a required signer for this contract")

        if signature.signed_at:
            raise ValueError("User has already signed this contract")

        # Update signature
        signature.signed_at = datetime.utcnow()
        signature.ip_address = ip_address
        signature.user_agent = user_agent
        signature.otp_verified = True  # Assuming OTP was verified before this call

        # Update required_signers in contract
        signers = list(contract.required_signers)
        for s in signers:
            if s["user_id"] == user.id:
                s["signed_at"] = signature.signed_at.isoformat()
        contract.required_signers = signers

        # Check if all signers have signed
        all_signed = all(s.get("signed_at") for s in signers)

        if all_signed:
            contract.status = ContractStatus.FULLY_SIGNED.value
            contract.signed_at = datetime.utcnow()
        else:
            contract.status = ContractStatus.PARTIALLY_SIGNED.value

        await self.db.flush()

        logger.info(f"User {user.id} signed contract {contract.contract_number}")
        return signature

    async def get_deal_contracts(self, deal_id: UUID) -> List[SignedContract]:
        """Get all contracts for a deal"""
        stmt = select(SignedContract).where(
            SignedContract.deal_id == deal_id
        ).order_by(SignedContract.created_at.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_contract(self, contract_id: UUID) -> Optional[SignedContract]:
        """Get a contract by ID"""
        stmt = select(SignedContract).where(SignedContract.id == contract_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
