# ТЗ: Агентские теги в фискальных чеках (54-ФЗ)

**Дата:** 2026-01-26
**Приоритет:** 🔴 Критичный
**Статус:** ✅ DONE

---

## 1. Проблема

### Текущее состояние
Платформа работает по **агентской схеме** (103-ФЗ не применяется, т.к. нет наличных).
Чек клиенту выдаёт **Платформа**, но без обязательных агентских тегов.

### Что не передаётся в T-Bank Checks API

| Тег ФФД | Название | Назначение |
|---------|----------|------------|
| **1057** | Признак агента | Указывает, что продавец действует как агент |
| **1226** | ИНН поставщика | ИНН реального исполнителя услуги |
| **1225** | Наименование поставщика | Название организации/ФИО СМЗ |
| **1171** | Телефон поставщика | Контактный телефон (опционально) |

### Последствия
- ФНС видит **всю выручку как вашу**, а не поставщиков
- Поставщики (ООО, ИП, СМЗ) не могут учесть доход корректно
- Риск доначислений и штрафов при проверке

---

## 2. Требуемый формат чека

### 2.1. Простой случай (один поставщик)

```json
{
  "TerminalKey": "...",
  "Amount": 45000000,
  "OrderId": "deal-uuid-123",
  "Receipt": {
    "Email": "client@example.com",
    "Taxation": "usn_income",
    "Items": [
      {
        "Name": "Услуги агента по сделке: ул. Ленина, 10",
        "Quantity": 1,
        "Price": 45000000,
        "Amount": 45000000,
        "PaymentMethod": "full_payment",
        "PaymentObject": "agent_commission",
        "Tax": "none",
        "AgentData": {
          "AgentSign": "agent"
        },
        "SupplierInfo": {
          "Inn": "772012345678",
          "Name": "Иванов Иван Иванович",
          "Phones": ["+79991234567"]
        }
      }
    ]
  }
}
```

### 2.2. Мульти-сплит (несколько поставщиков в одном чеке)

```json
{
  "TerminalKey": "...",
  "Amount": 45000000,
  "OrderId": "deal-uuid-123",
  "Receipt": {
    "Email": "client@example.com",
    "Taxation": "usn_income",
    "Items": [
      {
        "Name": "Услуги агентства недвижимости",
        "Quantity": 1,
        "Price": 27000000,
        "Amount": 27000000,
        "PaymentMethod": "full_payment",
        "PaymentObject": "agent_commission",
        "Tax": "vat20",
        "AgentData": {
          "AgentSign": "agent"
        },
        "SupplierInfo": {
          "Inn": "7707123456",
          "Name": "ООО АН Пример",
          "Phones": ["+74951234567"]
        }
      },
      {
        "Name": "Услуги риелтора",
        "Quantity": 1,
        "Price": 18000000,
        "Amount": 18000000,
        "PaymentMethod": "full_payment",
        "PaymentObject": "agent_commission",
        "Tax": "none",
        "AgentData": {
          "AgentSign": "agent"
        },
        "SupplierInfo": {
          "Inn": "772012345678",
          "Name": "Иванов Иван Иванович",
          "Phones": ["+79991234567"]
        }
      }
    ]
  }
}
```

---

## 3. Изменения в коде

### 3.1. Новые dataclass в `tbank_checks.py`

```python
# backend/app/services/fiscalization/tbank_checks.py

from dataclasses import dataclass, field
from typing import List, Optional


class AgentSign(str, Enum):
    """Признак агента (тег 1057)"""
    BANK_PAYING_AGENT = "bank_paying_agent"       # Банковский платежный агент
    BANK_PAYING_SUBAGENT = "bank_paying_subagent" # Банковский платежный субагент
    PAYING_AGENT = "paying_agent"                 # Платежный агент
    PAYING_SUBAGENT = "paying_subagent"           # Платежный субагент
    ATTORNEY = "attorney"                         # Поверенный
    COMMISSION_AGENT = "commission_agent"         # Комиссионер
    AGENT = "agent"                               # Агент (наш случай)


@dataclass
class AgentData:
    """Данные агента для чека (теги 1057, 1073, 1074, 1075)"""
    agent_sign: AgentSign  # Тег 1057 - признак агента
    operation: Optional[str] = None  # Тег 1044 - наименование операции (для платежных агентов)
    phones: Optional[List[str]] = None  # Тег 1073 - телефоны платежного агента
    receiver_phones: Optional[List[str]] = None  # Тег 1074 - телефоны оператора перевода
    transfer_phones: Optional[List[str]] = None  # Тег 1075 - телефоны оператора приема платежа


@dataclass
class SupplierInfo:
    """Данные поставщика для чека (теги 1225, 1226, 1171)"""
    inn: str  # Тег 1226 - ИНН поставщика (обязательно)
    name: Optional[str] = None  # Тег 1225 - наименование поставщика
    phones: Optional[List[str]] = None  # Тег 1171 - телефоны поставщика


@dataclass
class ReceiptItem:
    """Item in the receipt - ОБНОВЛЁННАЯ ВЕРСИЯ"""
    name: str
    quantity: Decimal
    price: int  # kopeks
    amount: int  # kopeks
    payment_method: PaymentMethod = PaymentMethod.FULL_PAYMENT
    payment_object: PaymentObject = PaymentObject.SERVICE
    vat: VatType = VatType.NONE

    # NEW: Агентские данные
    agent_data: Optional[AgentData] = None
    supplier_info: Optional[SupplierInfo] = None
```

### 3.2. Обновление метода `create_receipt` в `TBankChecksClient`

```python
# backend/app/services/fiscalization/tbank_checks.py

async def create_receipt(self, request: CreateReceiptRequest) -> ReceiptResponse:
    """Create a fiscal receipt with agent tags support."""

    if self.mock_mode:
        return await self._mock_create_receipt(request)

    items = []
    total_amount = 0

    for item in request.items:
        item_dict = {
            "Name": item.name[:128],
            "Quantity": float(item.quantity),
            "Price": item.price,
            "Amount": item.amount,
            "PaymentMethod": item.payment_method.value,
            "PaymentObject": item.payment_object.value,
            "Tax": item.vat.value,
        }

        # NEW: Добавляем агентские данные (тег 1057)
        if item.agent_data:
            item_dict["AgentData"] = {
                "AgentSign": item.agent_data.agent_sign.value,
            }
            if item.agent_data.operation:
                item_dict["AgentData"]["OperatorName"] = item.agent_data.operation
            if item.agent_data.phones:
                item_dict["AgentData"]["Phones"] = item.agent_data.phones

        # NEW: Добавляем данные поставщика (теги 1225, 1226, 1171)
        if item.supplier_info:
            item_dict["SupplierInfo"] = {
                "Inn": item.supplier_info.inn,
            }
            if item.supplier_info.name:
                item_dict["SupplierInfo"]["Name"] = item.supplier_info.name
            if item.supplier_info.phones:
                item_dict["SupplierInfo"]["Phones"] = item.supplier_info.phones

        items.append(item_dict)
        total_amount += item.amount

    # ... rest of the method
```

### 3.3. Обновление `FiscalReceiptService._send_receipt_to_tbank`

```python
# backend/app/services/fiscalization/fiscal_receipt_service.py

async def _send_receipt_to_tbank(
    self,
    fiscal_receipt: FiscalReceipt,
    deal: Deal,
) -> None:
    """Send receipt to T-Bank with agent tags for each recipient."""

    # Получаем всех получателей сплита
    recipients = await self._get_deal_split_recipients(deal.id)

    items = []

    for recipient in recipients:
        # Пропускаем platform_fee - это наша комиссия
        if recipient.role == RecipientRole.PLATFORM_FEE.value:
            continue

        # Формируем название позиции
        if recipient.role == RecipientRole.AGENCY.value:
            item_name = f"Услуги агентства недвижимости"
        elif recipient.role == RecipientRole.AGENT.value:
            item_name = f"Услуги риелтора"
        else:
            item_name = f"Услуги по сделке"

        # Добавляем адрес если есть место
        if deal.property_address and len(item_name) + len(deal.property_address) < 120:
            item_name += f": {deal.property_address}"

        # Определяем НДС по типу юрлица
        vat = VatType.NONE  # СМЗ без НДС
        if recipient.legal_type == LegalType.OOO.value:
            vat = VatType.VAT20  # ООО обычно с НДС
        elif recipient.legal_type == LegalType.IP.value:
            # ИП может быть с НДС или без - зависит от системы налогообложения
            # По умолчанию УСН без НДС
            vat = VatType.NONE

        # Формируем наименование поставщика
        supplier_name = await self._get_supplier_name(recipient)

        receipt_item = ReceiptItem(
            name=item_name[:128],
            quantity=Decimal("1"),
            price=int(recipient.calculated_amount * 100),  # в копейках
            amount=int(recipient.calculated_amount * 100),
            payment_method=PaymentMethod.FULL_PAYMENT,
            payment_object=PaymentObject.AGENT_COMMISSION,
            vat=vat,
            agent_data=AgentData(
                agent_sign=AgentSign.AGENT,
            ),
            supplier_info=SupplierInfo(
                inn=recipient.inn,
                name=supplier_name,
                phones=await self._get_supplier_phones(recipient),
            ),
        )

        items.append(receipt_item)

    # ... create and send request
```

### 3.4. Хелпер-методы для получения данных поставщика

```python
# backend/app/services/fiscalization/fiscal_receipt_service.py

async def _get_deal_split_recipients(self, deal_id: UUID) -> List[DealSplitRecipient]:
    """Get all split recipients for a deal."""
    stmt = select(DealSplitRecipient).where(
        DealSplitRecipient.deal_id == deal_id
    )
    result = await self.db.execute(stmt)
    return list(result.scalars().all())


async def _get_supplier_name(self, recipient: DealSplitRecipient) -> Optional[str]:
    """Get supplier name for receipt."""
    if recipient.organization_id:
        # Для агентства - название организации
        stmt = select(Organization).where(Organization.id == recipient.organization_id)
        result = await self.db.execute(stmt)
        org = result.scalar_one_or_none()
        if org:
            return org.legal_name

    if recipient.user_id:
        # Для агента - ФИО
        stmt = select(User).where(User.id == recipient.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if user:
            return f"{user.last_name} {user.first_name} {user.middle_name or ''}".strip()

    return None


async def _get_supplier_phones(self, recipient: DealSplitRecipient) -> Optional[List[str]]:
    """Get supplier phone numbers for receipt."""
    phones = []

    if recipient.user_id:
        stmt = select(User).where(User.id == recipient.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        if user and user.phone:
            phones.append(user.phone)

    if recipient.organization_id:
        stmt = select(Organization).where(Organization.id == recipient.organization_id)
        result = await self.db.execute(stmt)
        org = result.scalar_one_or_none()
        if org and org.phone:
            phones.append(org.phone)

    return phones if phones else None
```

---

## 4. Миграция БД (если нужно)

### 4.1. Проверить наличие полей в `DealSplitRecipient`

Уже есть:
- ✅ `inn` - ИНН поставщика
- ✅ `kpp` - КПП (для ООО)
- ✅ `legal_type` - тип юрлица (ip/ooo/se)

Возможно добавить:
```python
# backend/app/models/bank_split.py

class DealSplitRecipient(BaseModel):
    # ... existing fields ...

    # NEW: Для фискализации
    supplier_name = Column(String(255), nullable=True)  # Кэшированное название
    supplier_phone = Column(String(20), nullable=True)  # Кэшированный телефон
```

### 4.2. Миграция

```python
# backend/alembic/versions/xxx_add_supplier_cache_fields.py

def upgrade():
    op.add_column('deal_split_recipients',
        sa.Column('supplier_name', sa.String(255), nullable=True))
    op.add_column('deal_split_recipients',
        sa.Column('supplier_phone', sa.String(20), nullable=True))

def downgrade():
    op.drop_column('deal_split_recipients', 'supplier_name')
    op.drop_column('deal_split_recipients', 'supplier_phone')
```

---

## 5. Конфигурация

### 5.1. Новые настройки в `config.py`

```python
# backend/app/core/config.py

class Settings(BaseSettings):
    # ... existing settings ...

    # Fiscalization - Agent Tags
    FISCALIZATION_AGENT_SIGN: str = "agent"  # Признак агента по умолчанию
    FISCALIZATION_PLATFORM_INN: str = ""  # ИНН платформы (для комиссии платформы)
    FISCALIZATION_PLATFORM_NAME: str = "ООО Хауслер"  # Название платформы
```

---

## 6. Тестирование

### 6.1. Unit-тесты

```python
# backend/tests/services/test_fiscal_receipt_service.py

import pytest
from decimal import Decimal

from app.services.fiscalization.tbank_checks import (
    ReceiptItem, AgentData, SupplierInfo, AgentSign,
    PaymentMethod, PaymentObject, VatType
)


class TestReceiptItemWithAgentTags:
    """Test receipt items with agent tags."""

    def test_receipt_item_with_supplier_info(self):
        """Test that ReceiptItem correctly includes SupplierInfo."""
        item = ReceiptItem(
            name="Услуги риелтора",
            quantity=Decimal("1"),
            price=45000000,
            amount=45000000,
            agent_data=AgentData(agent_sign=AgentSign.AGENT),
            supplier_info=SupplierInfo(
                inn="772012345678",
                name="Иванов Иван Иванович",
                phones=["+79991234567"],
            ),
        )

        assert item.agent_data.agent_sign == AgentSign.AGENT
        assert item.supplier_info.inn == "772012345678"
        assert item.supplier_info.name == "Иванов Иван Иванович"

    def test_receipt_item_ooo_with_vat(self):
        """Test that OOO suppliers have VAT20."""
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

    def test_receipt_item_se_without_vat(self):
        """Test that self-employed have no VAT."""
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
    """Test T-Bank Checks client with agent tags."""

    @pytest.mark.asyncio
    async def test_create_receipt_with_agent_tags(self, mock_tbank_client):
        """Test that receipt request includes agent tags."""
        request = CreateReceiptRequest(
            receipt_type=ReceiptType.INCOME,
            items=[
                ReceiptItem(
                    name="Test service",
                    quantity=Decimal("1"),
                    price=10000,
                    amount=10000,
                    agent_data=AgentData(agent_sign=AgentSign.AGENT),
                    supplier_info=SupplierInfo(inn="123456789012"),
                ),
            ],
            client=ReceiptClient(email="test@example.com"),
        )

        response = await mock_tbank_client.create_receipt(request)

        # Verify mock was called with correct payload
        # ... assertions
```

### 6.2. Integration-тесты

```python
# backend/tests/integration/test_fiscalization_flow.py

@pytest.mark.asyncio
async def test_full_fiscalization_flow_with_multi_split(
    db: AsyncSession,
    deal_with_multi_split: Deal,
):
    """Test full fiscalization flow with multiple recipients."""
    service = FiscalReceiptService(db)

    # Create receipt
    receipt = await service.create_receipt_for_deal(deal_with_multi_split)

    assert receipt is not None
    assert receipt.status == FiscalReceiptStatus.PENDING.value

    # Verify meta contains all recipients
    assert "recipients" in receipt.meta
    assert len(receipt.meta["recipients"]) == 2  # agency + agent

    # Verify each recipient has INN
    for r in receipt.meta["recipients"]:
        assert "inn" in r
        assert "name" in r
```

---

## 7. Чеклист внедрения

### Этап 1: Структуры данных
- [ ] Добавить `AgentSign` enum
- [ ] Добавить `AgentData` dataclass
- [ ] Добавить `SupplierInfo` dataclass
- [ ] Обновить `ReceiptItem` с новыми полями
- [ ] Миграция БД (если нужны кэш-поля)

### Этап 2: Сервисы
- [ ] Обновить `TBankChecksClient.create_receipt()`
- [ ] Обновить `FiscalReceiptService._send_receipt_to_tbank()`
- [ ] Добавить хелперы `_get_supplier_name`, `_get_supplier_phones`
- [ ] Добавить хелпер `_get_deal_split_recipients`

### Этап 3: Тестирование
- [ ] Unit-тесты для новых dataclass
- [ ] Unit-тесты для обновлённых методов
- [ ] Integration-тест полного флоу
- [ ] Sandbox тест с T-Bank (реальный API)

### Этап 4: Production
- [ ] Выключить `TBANK_CHECKS_MOCK_MODE`
- [ ] Настроить credentials production
- [ ] Мониторинг ошибок фискализации
- [ ] Алерты на failed receipts

---

## 8. Ссылки

- [T-Bank Checks API Docs](https://www.tbank.ru/kassa/dev/checks/)
- [ФФД 1.2 Теги](https://www.nalog.gov.ru/rn77/related_activities/registries/fiscaldocuments/)
- [54-ФЗ](http://www.consultant.ru/document/cons_doc_LAW_42359/)

---

## 9. Вопросы для уточнения

1. **Система налогообложения ИП**: Нужно ли хранить tax_system в PaymentProfile?
   - Если ИП на ОСНО → НДС 20%
   - Если ИП на УСН → без НДС

2. **Телефоны поставщиков**: Обязательны или опциональны в чеке?
   - По ФФД 1.2 тег 1171 опционален

3. **Комиссия платформы**: Включать в чек или нет?
   - Если да → нужен отдельный item с ИНН платформы
   - Если нет → только суммы поставщиков

4. **КПП для ООО**: Нужен ли в SupplierInfo?
   - В стандартном T-Bank API нет поля для КПП в SupplierInfo
