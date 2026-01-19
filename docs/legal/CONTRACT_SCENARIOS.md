# Сценарии договоров: Матрица вариаций

## 1. ИЗМЕРЕНИЯ (DIMENSIONS)

### 1.1. Тип сделки с недвижимостью
| Код | Название | Описание |
|-----|----------|----------|
| `sale_buy` | Покупка | Клиент покупает объект |
| `sale_sell` | Продажа | Клиент продаёт объект |
| `rent_tenant` | Аренда (арендатор) | Клиент снимает объект |
| `rent_landlord` | Аренда (арендодатель) | Клиент сдаёт объект |

### 1.2. Тип объекта
| Код | Название |
|-----|----------|
| `apartment` | Квартира |
| `room` | Комната |
| `house` | Дом / Коттедж |
| `townhouse` | Таунхаус |
| `land` | Земельный участок |
| `commercial` | Коммерческая недвижимость |
| `parking` | Машиноместо / Гараж |

### 1.3. Тип оплаты услуг агента
| Код | Название | Описание |
|-----|----------|----------|
| `percent` | Процент от сделки | X% от суммы сделки |
| `fixed` | Фиксированная сумма | Конкретная сумма в рублях |
| `mixed` | Смешанный | Фикс + процент (редко) |

### 1.4. Аванс
| Код | Название | Описание |
|-----|----------|----------|
| `no_advance` | Без аванса | Полная оплата после услуги |
| `advance_fixed` | Фиксированный аванс | Конкретная сумма аванса |
| `advance_percent` | Процент аванса | X% от общей суммы |

### 1.5. Участники сделки
| Код | Описание | Стороны договора |
|-----|----------|------------------|
| `agent_client` | Агент ↔ Клиент | Самозанятый/ИП агент и физлицо |
| `agency_client` | Агентство ↔ Клиент | ООО агентство и физлицо |
| `agent_agent` | Агент ↔ Со-агент | Два агента делят комиссию |
| `agency_agent` | Агентство ↔ Агент | Внутренний договор агентства |

### 1.6. Плательщик комиссии
| Код | Описание |
|-----|----------|
| `client_pays` | Клиент платит агенту |
| `counterparty_pays` | Контрагент платит агенту |
| `split_payment` | Оба платят (50/50 или иначе) |

---

## 2. СЦЕНАРИИ (USE CASES)

### Сценарий A: Покупка квартиры (типичный)
```
Клиент: Покупатель
Агент: Помогает найти и купить квартиру
Оплата: % от суммы сделки (обычно 2-3%)
Плательщик: Покупатель (клиент)
Аванс: Нет (оплата после сделки)
```

### Сценарий B: Продажа квартиры
```
Клиент: Продавец
Агент: Помогает продать квартиру
Оплата: % от суммы сделки (обычно 2-5%)
Плательщик: Продавец (клиент)
Аванс: Возможен фикс на маркетинг
```

### Сценарий C: Аренда (арендатор)
```
Клиент: Арендатор
Агент: Помогает найти жильё
Оплата: Фикс = 1 месячная арендная плата
Плательщик: Арендатор
Аванс: Нет
```

### Сценарий D: Аренда (арендодатель)
```
Клиент: Владелец
Агент: Помогает найти арендатора
Оплата: 50% месячной ренты ИЛИ фикс
Плательщик: Владелец
Аванс: Нет
```

### Сценарий E: Со-агент (совместная сделка)
```
Участники: Агент 1 + Агент 2
Оплата: Делят комиссию (60/40, 50/50)
Договор: Между агентами о распределении
```

### Сценарий F: Эксклюзив
```
Особенность: Только один агент имеет право продавать
Срок: Ограниченный (3-6 месяцев)
Оплата: Гарантированная при продаже
```

---

## 3. ШАБЛОНЫ ДОГОВОРОВ

| ID | Название | Сценарии | Стороны |
|----|----------|----------|---------|
| `TPL-001` | Договор оказания услуг (покупка) | A | Агент ↔ Клиент-покупатель |
| `TPL-002` | Договор оказания услуг (продажа) | B | Агент ↔ Клиент-продавец |
| `TPL-003` | Договор оказания услуг (аренда) | C, D | Агент ↔ Клиент |
| `TPL-004` | Эксклюзивный договор | F | Агент ↔ Клиент-продавец |
| `TPL-005` | Соглашение о разделе комиссии | E | Агент ↔ Со-агент |
| `TPL-006` | Агентский договор | внутр. | Агентство ↔ Агент |

---

## 4. СТРУКТУРА ДАННЫХ (BACKEND)

### 4.1. Enum: DealType (тип сделки)
```python
class DealType(str, Enum):
    SALE_BUY = "sale_buy"           # Покупка
    SALE_SELL = "sale_sell"         # Продажа
    RENT_TENANT = "rent_tenant"     # Аренда (арендатор)
    RENT_LANDLORD = "rent_landlord" # Аренда (арендодатель)
```

### 4.2. Enum: PropertyType (тип объекта)
```python
class PropertyType(str, Enum):
    APARTMENT = "apartment"
    ROOM = "room"
    HOUSE = "house"
    TOWNHOUSE = "townhouse"
    LAND = "land"
    COMMERCIAL = "commercial"
    PARKING = "parking"
```

### 4.3. Enum: PaymentType (тип оплаты)
```python
class PaymentType(str, Enum):
    PERCENT = "percent"   # Процент от сделки
    FIXED = "fixed"       # Фиксированная сумма
    MIXED = "mixed"       # Фикс + процент
```

### 4.4. Enum: AdvanceType (тип аванса)
```python
class AdvanceType(str, Enum):
    NONE = "none"              # Без аванса
    FIXED = "advance_fixed"    # Фиксированный аванс
    PERCENT = "advance_percent" # Процент аванса
```

### 4.5. Модель: ContractTemplate
```python
class ContractTemplate(BaseModel):
    id: UUID
    code: str                    # TPL-001, TPL-002...
    name: str                    # Название
    deal_types: List[DealType]   # Применимые типы сделок
    party_types: List[str]       # agent_client, agency_client...
    template_text: str           # Текст шаблона с {{переменными}}
    version: int                 # Версия шаблона
    is_active: bool
```

### 4.6. Обновление модели Deal
```python
class Deal(BaseModel):
    # Существующие поля...

    # Новые поля
    deal_type: str              # DealType enum
    property_type: str          # PropertyType enum
    payment_type: str           # PaymentType enum

    # Оплата
    commission_percent: Decimal  # Если payment_type = percent
    commission_fixed: Decimal    # Если payment_type = fixed

    # Аванс
    advance_type: str           # AdvanceType enum
    advance_amount: Decimal     # Сумма аванса (если есть)
    advance_percent: Decimal    # Процент аванса (если есть)
    advance_paid: bool          # Аванс оплачен?
    advance_paid_at: DateTime   # Когда оплачен

    # Эксклюзив
    is_exclusive: bool          # Эксклюзивный договор?
    exclusive_until: DateTime   # Срок эксклюзива
```

---

## 5. UI ФОРМЫ (FRONTEND)

### 5.1. Шаг 1: Тип сделки
```
[  ] Покупка недвижимости
[  ] Продажа недвижимости
[  ] Аренда (ищу жильё)
[  ] Аренда (сдаю жильё)
```

### 5.2. Шаг 2: Тип объекта
```
[  ] Квартира
[  ] Комната
[  ] Дом / Коттедж
[  ] Таунхаус
[  ] Земельный участок
[  ] Коммерческая недвижимость
```

### 5.3. Шаг 3: Условия оплаты
```
Тип оплаты:
( ) Процент от суммы сделки
    └─ [___]% (от 0.5 до 10%)

( ) Фиксированная сумма
    └─ [___________] руб.

Аванс:
[ ] Требуется аванс
    └─ ( ) Фиксированный: [_____] руб.
       ( ) Процент от суммы: [__]%

Эксклюзив:
[ ] Эксклюзивный договор
    └─ Срок до: [дата]
```

### 5.4. Шаг 4: Данные объекта
```
Адрес: [__________________________]
Цена объекта: [______________] руб.
Площадь: [____] м²
```

### 5.5. Шаг 5: Подтверждение
```
┌─────────────────────────────────────┐
│ СВОДКА СДЕЛКИ                       │
├─────────────────────────────────────┤
│ Тип: Покупка квартиры               │
│ Адрес: г. Москва, ул. Примерная, 1  │
│ Цена: 15 000 000 руб.               │
│ Комиссия: 2% = 300 000 руб.         │
│ Комиссия платформы: 4% = 12 000 руб.│
│ К получению: 288 000 руб.           │
│ Аванс: Нет                          │
└─────────────────────────────────────┘

[Далее: Подписание договора]
```

---

## 6. ЛОГИКА РАСЧЁТОВ

### 6.1. Расчёт комиссии
```python
def calculate_commission(
    property_price: Decimal,
    payment_type: PaymentType,
    commission_percent: Optional[Decimal],
    commission_fixed: Optional[Decimal],
) -> Decimal:
    if payment_type == PaymentType.PERCENT:
        return property_price * (commission_percent / 100)
    elif payment_type == PaymentType.FIXED:
        return commission_fixed
    elif payment_type == PaymentType.MIXED:
        return commission_fixed + property_price * (commission_percent / 100)
```

### 6.2. Расчёт аванса
```python
def calculate_advance(
    total_commission: Decimal,
    advance_type: AdvanceType,
    advance_amount: Optional[Decimal],
    advance_percent: Optional[Decimal],
) -> Decimal:
    if advance_type == AdvanceType.NONE:
        return Decimal("0")
    elif advance_type == AdvanceType.FIXED:
        return min(advance_amount, total_commission)
    elif advance_type == AdvanceType.PERCENT:
        return total_commission * (advance_percent / 100)
```

### 6.3. Расчёт к оплате
```python
def calculate_payment_schedule(
    total_commission: Decimal,
    advance: Decimal,
    platform_fee_percent: Decimal = Decimal("4"),
) -> dict:
    platform_fee = total_commission * (platform_fee_percent / 100)
    agent_receives = total_commission - platform_fee

    return {
        "total_commission": total_commission,
        "platform_fee": platform_fee,
        "agent_receives": agent_receives,
        "advance_amount": advance,
        "final_payment": agent_receives - advance,
        "payments": [
            {"type": "advance", "amount": advance, "when": "до начала работ"},
            {"type": "final", "amount": agent_receives - advance, "when": "после сделки"},
        ] if advance > 0 else [
            {"type": "full", "amount": agent_receives, "when": "после сделки"},
        ]
    }
```

---

## 7. ПЛАН РЕАЛИЗАЦИИ

### Фаза 1: Модели и миграции (Backend)
- [ ] Добавить enum'ы DealType, PropertyType, PaymentType, AdvanceType
- [ ] Обновить модель Deal новыми полями
- [ ] Создать модель ContractTemplate
- [ ] Миграция БД

### Фаза 2: Сервисы (Backend)
- [ ] CommissionCalculator — расчёт комиссии
- [ ] AdvanceService — логика авансов
- [ ] ContractGenerator — генерация договоров из шаблонов

### Фаза 3: API (Backend)
- [ ] `GET /contract-templates` — список шаблонов
- [ ] `POST /deals` — обновить с новыми полями
- [ ] `POST /deals/{id}/calculate` — расчёт без создания
- [ ] `POST /deals/{id}/advance/pay` — оплата аванса

### Фаза 4: UI (Frontend)
- [ ] Новый wizard создания сделки (5 шагов)
- [ ] Компонент выбора типа оплаты
- [ ] Компонент настройки аванса
- [ ] Предпросмотр договора

### Фаза 5: Шаблоны договоров
- [ ] TPL-001: Покупка
- [ ] TPL-002: Продажа
- [ ] TPL-003: Аренда
- [ ] TPL-004: Эксклюзив
- [ ] TPL-005: Со-агент
- [ ] TPL-006: Агентство-Агент

---

## 8. ПРИОРИТЕТ

| Приоритет | Сценарий | Обоснование |
|-----------|----------|-------------|
| P0 | Покупка + % | Самый частый кейс |
| P0 | Продажа + % | Второй по частоте |
| P1 | Аренда + фикс | Частый кейс |
| P1 | Аванс | Нужен для дорогих сделок |
| P2 | Эксклюзив | Специальный случай |
| P2 | Со-агент | Уже частично есть |
| P3 | Смешанная оплата | Редкий случай |

---

*Документ: CONTRACT_SCENARIOS.md*
*Версия: 1.0*
*Дата: 2026-01-18*
