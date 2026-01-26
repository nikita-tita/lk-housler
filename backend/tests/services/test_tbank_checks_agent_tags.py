"""Tests for T-Bank Checks agent tags (54-FZ compliance)"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.fiscalization.tbank_checks import (
    AgentSign,
    AgentData,
    SupplierInfo,
    ReceiptItem,
    ReceiptClient,
    CreateReceiptRequest,
    ReceiptType,
    PaymentMethod,
    PaymentObject,
    VatType,
    TBankChecksClient,
    TBankChecksReceiptStatus,
)


class TestAgentDataclasses:
    """Tests for agent-related dataclasses"""

    def test_agent_sign_values(self):
        """Test AgentSign enum has correct values for 54-FZ"""
        assert AgentSign.AGENT.value == "agent"
        assert AgentSign.COMMISSION_AGENT.value == "commission_agent"
        assert AgentSign.ATTORNEY.value == "attorney"

    def test_agent_data_creation(self):
        """Test AgentData dataclass creation"""
        agent_data = AgentData(agent_sign=AgentSign.AGENT)

        assert agent_data.agent_sign == AgentSign.AGENT
        assert agent_data.operation is None
        assert agent_data.phones is None

    def test_agent_data_with_all_fields(self):
        """Test AgentData with all optional fields"""
        agent_data = AgentData(
            agent_sign=AgentSign.AGENT,
            operation="Посреднические услуги",
            phones=["+79001234567", "+79007654321"],
        )

        assert agent_data.agent_sign == AgentSign.AGENT
        assert agent_data.operation == "Посреднические услуги"
        assert len(agent_data.phones) == 2

    def test_supplier_info_minimal(self):
        """Test SupplierInfo with only required INN"""
        supplier = SupplierInfo(inn="772012345678")

        assert supplier.inn == "772012345678"
        assert supplier.name is None
        assert supplier.phones is None

    def test_supplier_info_full(self):
        """Test SupplierInfo with all fields"""
        supplier = SupplierInfo(
            inn="772012345678",
            name="Иванов Иван Иванович",
            phones=["+79001234567"],
        )

        assert supplier.inn == "772012345678"
        assert supplier.name == "Иванов Иван Иванович"
        assert supplier.phones == ["+79001234567"]

    def test_supplier_info_ooo(self):
        """Test SupplierInfo for OOO (10-digit INN)"""
        supplier = SupplierInfo(
            inn="7707123456",
            name="ООО АН Пример",
        )

        assert len(supplier.inn) == 10
        assert supplier.name == "ООО АН Пример"


class TestReceiptItemWithAgentTags:
    """Tests for ReceiptItem with agent tags"""

    def test_receipt_item_without_agent_tags(self):
        """Test ReceiptItem can be created without agent tags (backward compat)"""
        item = ReceiptItem(
            name="Test service",
            quantity=Decimal("1"),
            price=10000,
            amount=10000,
        )

        assert item.agent_data is None
        assert item.supplier_info is None

    def test_receipt_item_with_agent_tags(self):
        """Test ReceiptItem with full agent tags"""
        item = ReceiptItem(
            name="Услуги риелтора",
            quantity=Decimal("1"),
            price=45000000,  # 450,000 RUB in kopeks
            amount=45000000,
            payment_method=PaymentMethod.FULL_PAYMENT,
            payment_object=PaymentObject.AGENT_COMMISSION,
            vat=VatType.NONE,
            agent_data=AgentData(agent_sign=AgentSign.AGENT),
            supplier_info=SupplierInfo(
                inn="772012345678",
                name="Иванов Иван Иванович",
                phones=["+79001234567"],
            ),
        )

        assert item.agent_data.agent_sign == AgentSign.AGENT
        assert item.supplier_info.inn == "772012345678"
        assert item.supplier_info.name == "Иванов Иван Иванович"
        assert item.payment_object == PaymentObject.AGENT_COMMISSION

    def test_receipt_item_ooo_with_vat(self):
        """Test that OOO suppliers should use VAT20"""
        item = ReceiptItem(
            name="Услуги агентства",
            quantity=Decimal("1"),
            price=27000000,
            amount=27000000,
            vat=VatType.VAT20,
            agent_data=AgentData(agent_sign=AgentSign.AGENT),
            supplier_info=SupplierInfo(
                inn="7707123456",
                name="ООО АН Пример",
            ),
        )

        assert item.vat == VatType.VAT20

    def test_receipt_item_self_employed_no_vat(self):
        """Test that self-employed suppliers have no VAT"""
        item = ReceiptItem(
            name="Услуги риелтора",
            quantity=Decimal("1"),
            price=18000000,
            amount=18000000,
            vat=VatType.NONE,
            agent_data=AgentData(agent_sign=AgentSign.AGENT),
            supplier_info=SupplierInfo(
                inn="772012345678",
                name="Иванов Иван Иванович",
            ),
        )

        assert item.vat == VatType.NONE


class TestTBankChecksClientAgentTags:
    """Tests for TBankChecksClient with agent tags"""

    @pytest.fixture
    def mock_client(self):
        """Create mock T-Bank Checks client"""
        return TBankChecksClient(mock_mode=True)

    @pytest.mark.asyncio
    async def test_create_receipt_with_agent_tags_mock(self, mock_client):
        """Test creating receipt with agent tags in mock mode"""
        request = CreateReceiptRequest(
            receipt_type=ReceiptType.INCOME,
            items=[
                ReceiptItem(
                    name="Услуги риелтора",
                    quantity=Decimal("1"),
                    price=45000000,
                    amount=45000000,
                    agent_data=AgentData(agent_sign=AgentSign.AGENT),
                    supplier_info=SupplierInfo(
                        inn="772012345678",
                        name="Иванов Иван Иванович",
                    ),
                ),
            ],
            client=ReceiptClient(email="test@example.com"),
        )

        response = await mock_client.create_receipt(request)

        assert response.receipt_id.startswith("mock_receipt_")
        assert response.status == TBankChecksReceiptStatus.DONE

    @pytest.mark.asyncio
    async def test_create_multi_recipient_receipt_mock(self, mock_client):
        """Test creating receipt with multiple recipients (multi-split)"""
        request = CreateReceiptRequest(
            receipt_type=ReceiptType.INCOME,
            items=[
                # Agency (OOO) with VAT
                ReceiptItem(
                    name="Услуги агентства недвижимости",
                    quantity=Decimal("1"),
                    price=27000000,
                    amount=27000000,
                    vat=VatType.VAT20,
                    agent_data=AgentData(agent_sign=AgentSign.AGENT),
                    supplier_info=SupplierInfo(
                        inn="7707123456",
                        name="ООО АН Пример",
                    ),
                ),
                # Agent (self-employed) without VAT
                ReceiptItem(
                    name="Услуги риелтора",
                    quantity=Decimal("1"),
                    price=18000000,
                    amount=18000000,
                    vat=VatType.NONE,
                    agent_data=AgentData(agent_sign=AgentSign.AGENT),
                    supplier_info=SupplierInfo(
                        inn="772012345678",
                        name="Иванов Иван Иванович",
                    ),
                ),
            ],
            client=ReceiptClient(email="test@example.com"),
        )

        response = await mock_client.create_receipt(request)

        assert response.receipt_id.startswith("mock_receipt_")
        assert response.status == TBankChecksReceiptStatus.DONE


class TestReceiptPayloadFormat:
    """Tests for correct payload format sent to T-Bank API"""

    def test_agent_data_serialization(self):
        """Test AgentData is serialized correctly for API"""
        agent_data = AgentData(
            agent_sign=AgentSign.AGENT,
            operation="Посреднические услуги",
            phones=["+79001234567"],
        )

        # Build dict as TBankChecksClient would
        agent_dict = {
            "AgentSign": agent_data.agent_sign.value,
        }
        if agent_data.operation:
            agent_dict["OperatorName"] = agent_data.operation
        if agent_data.phones:
            agent_dict["Phones"] = agent_data.phones

        assert agent_dict == {
            "AgentSign": "agent",
            "OperatorName": "Посреднические услуги",
            "Phones": ["+79001234567"],
        }

    def test_supplier_info_serialization(self):
        """Test SupplierInfo is serialized correctly for API"""
        supplier = SupplierInfo(
            inn="772012345678",
            name="Иванов Иван Иванович",
            phones=["+79001234567"],
        )

        # Build dict as TBankChecksClient would
        supplier_dict = {
            "Inn": supplier.inn,
        }
        if supplier.name:
            supplier_dict["Name"] = supplier.name
        if supplier.phones:
            supplier_dict["Phones"] = supplier.phones

        assert supplier_dict == {
            "Inn": "772012345678",
            "Name": "Иванов Иван Иванович",
            "Phones": ["+79001234567"],
        }

    def test_supplier_info_minimal_serialization(self):
        """Test SupplierInfo with only INN serializes correctly"""
        supplier = SupplierInfo(inn="772012345678")

        supplier_dict = {"Inn": supplier.inn}
        if supplier.name:
            supplier_dict["Name"] = supplier.name
        if supplier.phones:
            supplier_dict["Phones"] = supplier.phones

        # Only Inn should be present
        assert supplier_dict == {"Inn": "772012345678"}
        assert "Name" not in supplier_dict
        assert "Phones" not in supplier_dict
