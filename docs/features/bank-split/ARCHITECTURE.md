# Архитектура: Instant Split

**Автор:** ARCH-LK
**Дата:** 2026-01-18
**Версия:** 2.0
**Статус:** APPROVED

---

## 1. Обзор

### 1.1. Модель

```
Договор → Подпись → Счет → Оплата → Авто-сплит (макс 1 час холда)
```

### 1.2. Принципы

1. **Housler НЕ участник денежного потока** — только витрина и арбитр
2. **Instant Split** — деньги сразу уходят участникам (не escrow)
3. **Договор = юридическая основа** — счет привязан к договору
4. **Event-driven** — все изменения через события
5. **Idempotency** — все внешние вызовы идемпотентны

---

## 2. Высокоуровневая архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТЫ                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  Web App    │    │ Mobile App  │    │  Agent App  │                     │
│  │  (Next.js)  │    │  (future)   │    │  (future)   │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         └──────────────────┴──────────────────┘                             │
│                            │                                                │
├────────────────────────────┼────────────────────────────────────────────────┤
│                            v                                                │
│                    ┌───────────────┐                                        │
│                    │   API Gateway │                                        │
│                    │   (FastAPI)   │                                        │
│                    └───────┬───────┘                                        │
│                            │                                                │
├────────────────────────────┼────────────────────────────────────────────────┤
│                            v                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      APPLICATION LAYER                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ DealService │  │ InvoiceServ │  │ DocumentServ│  │ SigningServ│ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         │                │                │                │        │   │
│  │         └────────────────┴────────────────┴────────────────┘        │   │
│  │                                   │                                  │   │
│  │                                   v                                  │   │
│  │                    ┌──────────────────────────┐                      │   │
│  │                    │    TBank Integration     │                      │   │
│  │                    │    (INTEG-LK zone)       │                      │   │
│  │                    └────────────┬─────────────┘                      │   │
│  │                                 │                                    │   │
│  └─────────────────────────────────┼────────────────────────────────────┘   │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    v                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      INFRASTRUCTURE LAYER                            │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │ PostgreSQL│  │   Redis   │  │   MinIO   │  │  Celery   │        │   │
│  │  │  (data)   │  │  (cache)  │  │   (S3)    │  │  (jobs)   │        │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          EXTERNAL SYSTEMS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                   │
│  │   Т-Банк API  │  │ agent.housler │  │    SMS.RU     │                   │
│  │   (payments)  │  │   (auth)      │  │   (notify)    │                   │
│  └───────────────┘  └───────────────┘  └───────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Компоненты

### 3.1. Application Services

| Сервис | Ответственность | Зависимости |
|--------|-----------------|-------------|
| `DealService` | CRUD сделок, state machine | DB, EventBus |
| `InvoiceService` | Создание счетов, привязка к договору | DB, TBankClient |
| `DocumentService` | Генерация PDF, хранение | DB, MinIO, Templates |
| `SigningService` | ПЭП, токены подписания, OTP | DB, Redis, SMS |
| `SplitService` | Расчет долей, валидация | DB |
| `NotificationService` | SMS, email, push | SMS.RU, Redis |

### 3.2. Integration Services (INTEG-LK zone)

| Сервис | Ответственность |
|--------|-----------------|
| `TBankClient` | HTTP клиент, retry, circuit breaker |
| `TBankDealClient` | Создание сделок в банке |
| `TBankPaymentClient` | Инициация платежей, получение статуса |
| `TBankSelfEmployedClient` | Работа с реестром СЗ |
| `TBankWebhookHandler` | Обработка событий от банка |
| `ReconciliationJob` | Сверка статусов |

### 3.3. Domain Events

```python
# Внутренние события (EventBus)
DealCreated
DealSigningStarted
DealSigned
InvoiceCreated
PaymentInitiated
PaymentCompleted
PaymentFailed
SplitExecuted
DealCompleted
DealDisputed
DealCancelled

# Внешние события (от банка)
TBankPaymentReceived
TBankPayoutCompleted
TBankPayoutFailed
TBankReceiptReady
```

---

## 4. Потоки данных

### 4.1. Создание сделки и подписание

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Agent   │────>│ DealServ │────>│ DocServ  │────>│ SignServ │
│  (FE)    │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │   1. Create    │                │                │
     │   deal draft   │                │                │
     │ ──────────────>│                │                │
     │                │                │                │
     │                │ 2. Generate    │                │
     │                │    contract    │                │
     │                │ ──────────────>│                │
     │                │                │                │
     │                │                │ 3. Create      │
     │                │                │    sign tokens │
     │                │                │ ──────────────>│
     │                │                │                │
     │<─────────────────────────────────────────────────│
     │         4. Return sign links                     │
     │                                                  │
```

### 4.2. Оплата и автосплит

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────>│ InvServ  │────>│ TBankCli │────>│ TBank API│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │ 1. Pay invoice │                │                │
     │ ──────────────>│                │                │
     │                │ 2. Create      │                │
     │                │    payment     │                │
     │                │ ──────────────>│                │
     │                │                │ 3. Init        │
     │                │                │    payment     │
     │                │                │ ──────────────>│
     │                │                │                │
     │<───────────────│<───────────────│<───────────────│
     │         4. Payment link / QR                     │
     │                                                  │
     │ 5. Client pays via bank                         │
     │ ────────────────────────────────────────────────>│
     │                                                  │
     │                                                  │
┌──────────┐     ┌──────────┐     ┌──────────┐          │
│ Webhook  │<────│ TBankWH  │<────│          │<─────────│
│ Handler  │     │ Handler  │     │          │  6. Webhook
└──────────┘     └──────────┘     └──────────┘
     │                │
     │ 7. Update      │
     │    deal status │
     │ ──────────────>│
     │                │
     │ 8. After hold  │
     │    -> COMPLETED│
     │                │
```

### 4.3. State Machine (детально)

```
                                        ┌──────────────┐
                                        │   CANCELLED  │
                                        └──────────────┘
                                              ^
                                              │ cancel()
                                              │
┌──────────┐  create()  ┌──────────┐  send_for_sign()  ┌──────────┐
│  DRAFT   │ ─────────> │  DRAFT   │ ────────────────> │ SIGNING  │
└──────────┘            └──────────┘                   └──────────┘
                                                            │
                                                            │ all_signed()
                                                            v
                                                       ┌──────────┐
                                                       │  SIGNED  │
                                                       └──────────┘
                                                            │
                                                            │ create_invoice()
                                                            v
                                                       ┌──────────┐
                                                       │ INVOICED │
                                                       └──────────┘
                                                            │
                                                            │ payment_started()
                                                            v
                                                       ┌──────────┐
                        payment_failed()               │ PAYMENT  │
                       ┌───────────────────────────────│ PENDING  │
                       │                               └──────────┘
                       v                                    │
                  ┌──────────┐                              │ payment_completed()
                  │ PAYMENT  │                              v
                  │ FAILED   │                         ┌──────────┐
                  └──────────┘                         │   PAID   │
                       │                               └──────────┘
                       │ retry()                            │
                       └───────────────────────────────>    │ start_hold()
                                                            v
                                                       ┌──────────┐
                                         dispute()     │   HOLD   │
                                        ┌──────────────│  PERIOD  │
                                        │              └──────────┘
                                        v                   │
                                   ┌──────────┐             │ hold_expired()
                                   │ DISPUTED │             v
                                   └──────────┘        ┌──────────┐
                                        │              │COMPLETED │
                                        │ resolve()    └──────────┘
                                        v
                                   ┌──────────┐
                                   │ REFUNDED │
                                   └──────────┘
```

---

## 5. Интеграция с Т-Банком

### 5.1. Архитектура интеграции

```
┌─────────────────────────────────────────────────────────────────┐
│                     TBank Integration Module                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    TBankClient (base)                    │   │
│  │  - HTTP client (httpx async)                            │   │
│  │  - Auth (Bearer token)                                   │   │
│  │  - Retry with exponential backoff                        │   │
│  │  - Circuit breaker                                       │   │
│  │  - Request/Response logging                              │   │
│  │  - Idempotency key management                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │              │              │              │          │
│         v              v              v              v          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │  Deals    │  │ Payments  │  │   Self-   │  │  Webhooks │   │
│  │  Client   │  │  Client   │  │ Employed  │  │  Handler  │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2. Маппинг операций

| Операция Housler | TBank API | Когда вызывается |
|------------------|-----------|------------------|
| Создать счет | `POST /deals` | После подписания договора |
| Получить ссылку на оплату | `POST /payments/init` | При запросе клиента |
| Проверить статус | `GET /deals/{id}` | Reconciliation job |
| Отменить | `POST /deals/{id}/cancel` | При отмене до оплаты |

### 5.3. Webhook Events

| Event Type | Действие в Housler |
|------------|-------------------|
| `payment.pending` | Deal -> PAYMENT_PENDING |
| `payment.completed` | Deal -> PAID, start hold timer |
| `payment.failed` | Deal -> PAYMENT_FAILED, notify |
| `payout.completed` | Update recipient status |
| `payout.failed` | Alert, manual intervention |

### 5.4. Error Handling

```python
class TBankErrorHandler:
    """Стратегия обработки ошибок"""

    RETRY_CODES = [429, 500, 502, 503, 504]
    NO_RETRY_CODES = [400, 401, 403, 422]

    async def handle(self, error: TBankError) -> Action:
        if error.status_code == 429:
            # Rate limit - wait and retry
            return Action.RETRY_WITH_BACKOFF

        if error.status_code in self.NO_RETRY_CODES:
            # Client error - log and fail
            return Action.FAIL_PERMANENT

        if error.status_code in self.RETRY_CODES:
            # Server error - retry
            return Action.RETRY

        return Action.FAIL_UNKNOWN
```

---

## 6. Финансовая модель "Мультирасчеты"

### 6.1. Housler как технологический оператор (НЕ платёжный агент)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ФИНАНСОВЫЙ ПОТОК                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Клиент платит: 100,000 ₽                                                   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  Т-Банк (транзитный счёт)                            │   │
│  │                                                                      │   │
│  │  1. Принимает платёж от клиента                                     │   │
│  │  2. Холдирует на номинальном счёте (до 30 дней)                     │   │
│  │  3. После release автоматически:                                    │   │
│  │     - Удерживает комиссию сервиса (4%) → Housler                    │   │
│  │     - Перечисляет остаток получателям напрямую                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                    │                                                        │
│         ┌─────────┴─────────┬──────────────────┐                           │
│         ▼                   ▼                  ▼                            │
│  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐                    │
│  │   Housler   │     │   Агент     │    │  Агентство  │                    │
│  │  (4% fee)   │     │ (60% от 96%)│    │ (40% от 96%)│                    │
│  │   4,000 ₽   │     │  57,600 ₽   │    │  38,400 ₽   │                    │
│  └─────────────┘     └─────────────┘    └─────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2. Ключевые принципы модели

| Принцип | Описание | Выгода |
|---------|----------|--------|
| **Housler НЕ касается основных денег** | Все платежи идут через Т-Банк | Нет рисков 103-ФЗ (платёжные агенты) |
| **Комиссия удерживается банком** | Настраивается в ЛК Т-Банка | Налог только с комиссии |
| **Прямые выплаты получателям** | Банк → Агент/Агентство напрямую | Мгновенные переводы, СБП |
| **Номинальный счёт** | Деньги на счёте банка, не Housler | Защита от claims |

### 6.3. Сравнение моделей

| Модель | Housler OLD (НЕ ИСПОЛЬЗУЕМ) | Housler NEW (Мультирасчеты) |
|--------|-----------------------------|-----------------------------|
| Поток денег | Клиент → Housler → Агенты | Клиент → Банк → Агенты |
| Юр. статус | Платёжный агент | Технологический оператор |
| Налоговая база | Весь оборот | Только комиссия |
| 103-ФЗ | Требуется | Не требуется |
| Риски | Высокие (держим чужие деньги) | Минимальные |

### 6.4. Почему Housler НЕ участвует в Splits

Т-Банк API позволяет указать splits — получателей платежа. Но **комиссия сервиса (Housler) НЕ указывается в splits!**

**Причина:** Комиссия настраивается на уровне терминала в личном кабинете Т-Банка:
- При создании терминала указывается % комиссии площадки
- Банк автоматически удерживает эту сумму при каждой выплате
- Housler получает комиссию отдельной транзакцией

```python
# ПРАВИЛЬНО: В splits только агенты
splits = [
    TBankDealSplit(recipient_id="agent_123", amount=57600_00),     # 57,600 ₽
    TBankDealSplit(recipient_id="agency_456", amount=38400_00),    # 38,400 ₽
]
# Total: 96,000 ₽ (100% - 4% комиссия)
# Комиссия 4,000 ₽ удерживается банком автоматически

# НЕПРАВИЛЬНО: Housler как recipient
splits = [
    TBankDealSplit(recipient_id="housler_platform", amount=4000_00),  # ❌
    TBankDealSplit(recipient_id="agent_123", amount=57600_00),
    TBankDealSplit(recipient_id="agency_456", amount=38400_00),
]
```

### 6.5. Конфигурация комиссии

```python
# backend/app/core/config.py
PLATFORM_FEE_PERCENT: Decimal = Decimal("4")  # 4% комиссия Housler

# Комиссия применяется на уровне UI для информирования пользователя
# Фактическое удержание происходит на стороне Т-Банка
```

### 6.6. Расчёт сумм для UI

```python
def calculate_display_amounts(commission_total: Decimal) -> dict:
    """
    Расчёт сумм для отображения пользователю.

    Комиссия вычитается ИЗ СУММЫ АГЕНТОВ (не добавляется сверху).
    """
    platform_fee = commission_total * settings.PLATFORM_FEE_PERCENT / 100
    agent_receives = commission_total - platform_fee

    return {
        "client_pays": commission_total,       # 100,000 ₽
        "platform_fee": platform_fee,          # 4,000 ₽
        "agents_receive": agent_receives,      # 96,000 ₽
    }
```

---

## 7. API Контракты (Housler API)

### 7.1. Deals API

```yaml
# POST /api/v1/deals
# Создать сделку (договор)
Request:
  type: string  # "secondary_buy", "secondary_sell", "newbuild_booking"
  client:
    name: string
    phone: string
    email: string?
  property_address: string
  price: number
  commission_total: number
  split:
    - recipient_type: string  # "agent", "agency"
      recipient_id: uuid
      percent: number

Response:
  id: uuid
  status: "draft"
  created_at: datetime

# POST /api/v1/deals/{id}/send-for-signing
# Отправить на подписание
Response:
  status: "signing"
  signing_links:
    - party_id: uuid
      role: string
      link: string
      expires_at: datetime

# POST /api/v1/deals/{id}/create-invoice
# Создать счет (после подписания)
Response:
  invoice_id: uuid
  status: "invoiced"
  payment_link: string
  payment_qr: string
  expires_at: datetime

# GET /api/v1/deals/{id}
# Получить сделку
Response:
  id: uuid
  status: string
  type: string
  client: object
  property_address: string
  price: number
  commission_total: number
  split: array
  documents: array
  timeline: array  # история статусов
```

### 7.2. Webhooks API (для Т-Банка)

```yaml
# POST /api/v1/webhooks/tbank
# Получить событие от банка
Request:
  Headers:
    X-Signature: string  # HMAC подпись
  Body:
    event_id: string
    event_type: string
    timestamp: datetime
    data: object

Response:
  status: "ok"
```

---

## 8. Безопасность

### 8.1. Аутентификация

| Компонент | Метод |
|-----------|-------|
| User -> API | JWT (от agent.housler.ru) |
| API -> TBank | Bearer token + mTLS (опционально) |
| TBank -> Webhook | HMAC signature |

### 8.2. Авторизация (RBAC)

```python
class DealPermissions:
    # Кто может создавать сделки
    CREATE = ["agent", "agency_admin"]

    # Кто может видеть сделку
    VIEW = ["agent", "agency_admin", "agency_accountant", "client"]

    # Кто может отменять
    CANCEL = ["agent", "agency_admin"]  # только до оплаты

    # Кто может оспаривать
    DISPUTE = ["client"]  # только в период холда
```

### 8.3. Валидация данных

```python
# Все входные данные валидируются Pydantic
class CreateDealRequest(BaseModel):
    type: DealType
    client: ClientInfo
    price: Decimal = Field(gt=0, le=100_000_000)  # max 100M
    commission_total: Decimal = Field(gt=0)
    split: List[SplitItem]

    @validator('split')
    def validate_split(cls, v):
        total = sum(item.percent for item in v)
        if total != 100:
            raise ValueError('Split must sum to 100%')
        return v
```

### 8.4. Audit Trail

Все действия логируются:

```python
@dataclass
class AuditEntry:
    entity_type: str  # "deal", "invoice", "payment"
    entity_id: UUID
    action: str  # "created", "status_changed", "cancelled"
    actor_user_id: int
    actor_ip: str
    actor_user_agent: str
    old_value: dict | None
    new_value: dict | None
    timestamp: datetime
```

---

## 9. Инфраструктура

### 8.1. Deployment

```yaml
# docker-compose.prod.yml additions
services:
  celery-worker:
    image: lk-backend
    command: celery -A app.worker worker -l info
    environment:
      - CELERY_BROKER_URL=redis://lk-redis:6379/1

  celery-beat:
    image: lk-backend
    command: celery -A app.worker beat -l info
    environment:
      - CELERY_BROKER_URL=redis://lk-redis:6379/1
```

### 8.2. Background Jobs

| Job | Schedule | Описание |
|-----|----------|----------|
| `reconciliation` | */5 min | Сверка статусов с банком |
| `hold_expiry_check` | */1 min | Проверка истечения холда |
| `payment_link_expiry` | */10 min | Уведомление об истечении ссылки |
| `cleanup_drafts` | daily | Удаление старых черновиков |

### 8.3. Мониторинг

```yaml
# Метрики (Prometheus)
deals_created_total
deals_completed_total
deals_failed_total
payment_duration_seconds
tbank_api_latency_seconds
tbank_api_errors_total
webhook_processing_duration_seconds
```

### 8.4. Алерты

| Метрика | Порог | Действие |
|---------|-------|----------|
| `tbank_api_errors_total` | > 10/min | PagerDuty |
| `payment_duration_seconds` | > 300s | Slack |
| `deals_in_hold_too_long` | > 2h | Slack |
| `webhook_failures` | > 5/min | PagerDuty |

---

## 10. Миграция

### 9.1. Feature Flag

```python
# Включение новой модели
FEATURE_FLAGS = {
    "instant_split_enabled": False,  # True для пилота
    "instant_split_orgs": [],  # список org_id для пилота
}

def should_use_instant_split(org_id: UUID) -> bool:
    if FEATURE_FLAGS["instant_split_enabled"]:
        return True
    return str(org_id) in FEATURE_FLAGS["instant_split_orgs"]
```

### 9.2. Rollout Plan

| Этап | Описание | Критерий перехода |
|------|----------|-------------------|
| 1 | Sandbox тестирование | Все тесты green |
| 2 | 1 пилотное агентство | 10 успешных сделок |
| 3 | 10% агентств | 100 успешных сделок, < 1% ошибок |
| 4 | 50% агентств | 1000 успешных сделок |
| 5 | 100% агентств | Стабильная работа |

---

## 11. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| TBank API недоступен | Средняя | Высокое | Circuit breaker, fallback UI |
| Webhook потерян | Низкая | Высокое | Reconciliation job каждые 5 мин |
| Двойная оплата | Низкая | Среднее | Idempotency key, дедупликация |
| Клиент оспорил после холда | Средняя | Низкое | Вне платформы, evidence pack |

---

## 12. Зависимости для разработки

### 11.1. Новые пакеты

```txt
# requirements.txt additions
httpx>=0.25.0          # async HTTP client
circuitbreaker>=2.0.0  # circuit breaker
tenacity>=8.0.0        # retry logic
celery>=5.3.0          # background jobs
redis>=5.0.0           # celery broker
```

### 11.2. Переменные окружения

```env
# .env additions
TBANK_API_URL=https://secured-openapi.tbank.ru
TBANK_API_TOKEN=xxx
TBANK_WEBHOOK_SECRET=xxx
TBANK_NOMINAL_ACCOUNT=40817810000000000001

CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

HOLD_PERIOD_MINUTES=60
```

---

## 13. Definition of Done (Architecture)

- [x] Высокоуровневая архитектура описана
- [x] Компоненты и сервисы определены
- [x] Интеграция с TBank спроектирована
- [x] State machine детализирована
- [x] API контракты описаны
- [x] Безопасность продумана
- [x] Инфраструктура описана
- [x] Риски идентифицированы

---

*Создано: 2026-01-16*
*Обновлено: 2026-01-18 (v2.0 — добавлена финансовая модель "Мультирасчеты")*
*Автор: ARCH-LK*
