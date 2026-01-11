"""Template service implementation"""

import re
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import ContractTemplate, TemplateType, TemplateStatus
from app.models.user import User
from app.services.document.generator import DocumentGenerator, ContractTemplates


class TemplateService:
    """Service for managing contract templates"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.generator = DocumentGenerator()

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def list_templates(
        self,
        code: Optional[str] = None,
        status: Optional[TemplateStatus] = None,
        active_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[ContractTemplate], int]:
        """List templates with filters"""
        conditions = []

        if code:
            conditions.append(ContractTemplate.code == code)
        if status:
            conditions.append(ContractTemplate.status == status)
        if active_only:
            conditions.append(ContractTemplate.active.is_(True))

        # Count total
        count_stmt = select(func.count(ContractTemplate.id))
        if conditions:
            count_stmt = count_stmt.where(and_(*conditions))
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar() or 0

        # Get items
        stmt = (
            select(ContractTemplate)
            .order_by(ContractTemplate.code, ContractTemplate.version.desc())
            .limit(limit)
            .offset(offset)
        )
        if conditions:
            stmt = stmt.where(and_(*conditions))

        result = await self.db.execute(stmt)
        templates = list(result.scalars().all())

        return templates, total

    async def get_by_id(self, template_id: UUID) -> Optional[ContractTemplate]:
        """Get template by ID"""
        stmt = select(ContractTemplate).where(ContractTemplate.id == template_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_template(self, code: str) -> Optional[ContractTemplate]:
        """Get active template by code"""
        stmt = select(ContractTemplate).where(
            and_(
                ContractTemplate.code == code,
                ContractTemplate.active.is_(True),
                ContractTemplate.status == TemplateStatus.PUBLISHED
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self,
        code: str,
        template_type: TemplateType,
        name: str,
        template_body: str,
        placeholders_schema: Dict[str, Any],
        version: str = "1.0",
        description: Optional[str] = None,
        legal_basis: Optional[str] = None,
        effective_from: Optional[datetime] = None,
        created_by: Optional[User] = None
    ) -> ContractTemplate:
        """Create new template"""
        template = ContractTemplate(
            code=code,
            type=template_type,
            version=version,
            name=name,
            description=description,
            template_body=template_body,
            placeholders_schema=placeholders_schema,
            legal_basis=legal_basis,
            effective_from=effective_from,
            status=TemplateStatus.DRAFT,
            active=False,
            created_by_user_id=created_by.id if created_by else None
        )
        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def update(
        self,
        template: ContractTemplate,
        name: Optional[str] = None,
        description: Optional[str] = None,
        template_body: Optional[str] = None,
        placeholders_schema: Optional[Dict[str, Any]] = None,
        legal_basis: Optional[str] = None,
        effective_from: Optional[datetime] = None
    ) -> ContractTemplate:
        """Update template (only drafts can be updated)"""
        if template.status != TemplateStatus.DRAFT:
            raise ValueError("Only draft templates can be updated")

        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if template_body is not None:
            template.template_body = template_body
        if placeholders_schema is not None:
            template.placeholders_schema = placeholders_schema
        if legal_basis is not None:
            template.legal_basis = legal_basis
        if effective_from is not None:
            template.effective_from = effective_from

        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def delete(self, template: ContractTemplate) -> bool:
        """Delete template (only drafts can be deleted)"""
        if template.status != TemplateStatus.DRAFT:
            raise ValueError("Only draft templates can be deleted")

        await self.db.delete(template)
        await self.db.flush()
        return True

    # =========================================================================
    # Workflow Operations
    # =========================================================================

    async def submit_for_review(self, template: ContractTemplate) -> ContractTemplate:
        """Submit template for review"""
        if template.status != TemplateStatus.DRAFT:
            raise ValueError("Only drafts can be submitted for review")

        # Validate before submission
        validation = self.validate_template(template.template_body, template.placeholders_schema)
        if not validation["valid"]:
            raise ValueError(f"Template validation failed: {', '.join(validation['errors'])}")

        template.status = TemplateStatus.PENDING_REVIEW
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def approve(
        self,
        template: ContractTemplate,
        approved_by: User
    ) -> ContractTemplate:
        """Approve template (requires legal role)"""
        if template.status != TemplateStatus.PENDING_REVIEW:
            raise ValueError("Only pending templates can be approved")

        template.status = TemplateStatus.APPROVED
        template.approved_by_user_id = approved_by.id
        template.approved_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def publish(self, template: ContractTemplate) -> ContractTemplate:
        """Publish approved template"""
        if template.status != TemplateStatus.APPROVED:
            raise ValueError("Only approved templates can be published")

        template.status = TemplateStatus.PUBLISHED
        template.published_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def activate(self, template: ContractTemplate) -> ContractTemplate:
        """Activate template (deactivate others with same code)"""
        if template.status != TemplateStatus.PUBLISHED:
            raise ValueError("Only published templates can be activated")

        # Deactivate other templates with same code
        stmt = (
            select(ContractTemplate)
            .where(
                and_(
                    ContractTemplate.code == template.code,
                    ContractTemplate.id != template.id,
                    ContractTemplate.active.is_(True)
                )
            )
        )
        result = await self.db.execute(stmt)
        for other in result.scalars().all():
            other.active = False

        template.active = True
        await self.db.flush()
        await self.db.refresh(template)
        return template

    async def archive(self, template: ContractTemplate) -> ContractTemplate:
        """Archive template"""
        if template.active:
            raise ValueError("Cannot archive active template. Deactivate first.")

        template.status = TemplateStatus.ARCHIVED
        await self.db.flush()
        await self.db.refresh(template)
        return template

    # =========================================================================
    # Validation & Preview
    # =========================================================================

    def validate_template(
        self,
        template_body: str,
        placeholders_schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Validate template HTML and placeholders"""
        errors = []
        warnings = []

        # Find all placeholders in template
        placeholders_found = set(re.findall(r'\{\{(\w+)\}\}', template_body))

        # Check required placeholders from schema
        required = placeholders_schema.get("required", [])
        for req in required:
            if req not in placeholders_found:
                errors.append(f"Required placeholder '{req}' not found in template")

        # Check for unknown placeholders
        known = set(placeholders_schema.get("properties", {}).keys())
        unknown = placeholders_found - known
        for unk in unknown:
            warnings.append(f"Unknown placeholder '{unk}' found in template")

        # Check HTML validity (basic)
        if "<html" not in template_body.lower():
            errors.append("Template must contain <html> tag")
        if "</body>" not in template_body.lower():
            errors.append("Template must contain </body> tag")

        # Check size
        if len(template_body) > 500 * 1024:  # 500KB
            errors.append("Template size exceeds 500KB limit")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "placeholders_found": list(placeholders_found)
        }

    def preview_template(
        self,
        template_body: str,
        test_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Preview template with test data"""
        # Find all placeholders
        placeholders = set(re.findall(r'\{\{(\w+)\}\}', template_body))

        # Check which are provided and which are missing
        provided = set(test_data.keys())
        used = placeholders & provided
        missing = placeholders - provided

        # Render with test data
        html = self.generator.render_template(template_body, test_data)

        return {
            "html": html,
            "placeholders_used": list(used),
            "placeholders_missing": list(missing)
        }

    # =========================================================================
    # Seed Hardcoded Templates
    # =========================================================================

    async def seed_hardcoded_templates(self) -> List[ContractTemplate]:
        """Seed database with hardcoded templates from Python code"""
        templates_data = [
            {
                "code": "secondary_buy",
                "type": TemplateType.SECONDARY_BUY,
                "name": "Договор на подбор объекта (покупка вторичной недвижимости)",
                "template_body": ContractTemplates.SECONDARY_BUY_TEMPLATE,
                "legal_basis": "ГК РФ глава 39, 63-ФЗ, 152-ФЗ"
            },
            {
                "code": "secondary_sell",
                "type": TemplateType.SECONDARY_SELL,
                "name": "Договор на продажу объекта (продажа вторичной недвижимости)",
                "template_body": ContractTemplates.SECONDARY_SELL_TEMPLATE,
                "legal_basis": "ГК РФ глава 39, 63-ФЗ, 152-ФЗ"
            },
            {
                "code": "newbuild_booking",
                "type": TemplateType.NEWBUILD_BOOKING,
                "name": "Договор на бронирование квартиры в новостройке",
                "template_body": ContractTemplates.NEWBUILD_BOOKING_TEMPLATE,
                "legal_basis": "ГК РФ глава 39, 63-ФЗ, 152-ФЗ, 214-ФЗ"
            },
            {
                "code": "act",
                "type": TemplateType.ACT,
                "name": "Акт сдачи-приемки оказанных услуг",
                "template_body": ContractTemplates.ACT_TEMPLATE,
                "legal_basis": "ГК РФ ст. 720"
            },
        ]

        # Default placeholders schema
        default_schema = {
            "type": "object",
            "required": [
                "contract_number",
                "contract_date",
                "executor_name",
                "executor_inn",
                "client_name",
                "client_phone",
                "property_address",
                "commission_total"
            ],
            "properties": {
                "contract_number": {"type": "string"},
                "contract_date": {"type": "string"},
                "executor_name": {"type": "string"},
                "executor_inn": {"type": "string"},
                "executor_kpp": {"type": "string"},
                "executor_ogrn": {"type": "string"},
                "executor_address": {"type": "string"},
                "executor_phone": {"type": "string"},
                "executor_email": {"type": "string"},
                "executor_bank_block": {"type": "string"},
                "client_name": {"type": "string"},
                "client_phone": {"type": "string"},
                "property_address": {"type": "string"},
                "commission_total": {"type": "string"},
                "commission_words": {"type": "string"},
                "payment_plan_rows": {"type": "string"},
                "document_hash": {"type": "string"},
            }
        }

        created = []
        for data in templates_data:
            # Check if already exists
            existing = await self.get_active_template(data["code"])
            if existing:
                continue

            template = await self.create(
                code=data["code"],
                template_type=data["type"],
                name=data["name"],
                template_body=data["template_body"],
                placeholders_schema=default_schema,
                version="1.0",
                legal_basis=data["legal_basis"]
            )
            # Auto-publish and activate
            template.status = TemplateStatus.PUBLISHED
            template.published_at = datetime.utcnow()
            template.active = True
            await self.db.flush()
            created.append(template)

        return created
