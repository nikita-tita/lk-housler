# Декомпозиция: Instant Split

**Дата:** 2026-01-16
**Автор:** TPM-LK
**Статус:** IN DEVELOPMENT (Backend + Frontend Complete)
**Обновлено:** 2026-01-17

---

## Обзор

| Метрика | Значение |
|---------|----------|
| Эпиков | 8 |
| Задач | 34 |
| Критический путь | E1 → E2 → E3 → E4 → E5 |
| **Прогресс** | **85%** (Backend 100%, Frontend 100%) |

---

## Эпики

| # | Эпик | Задач | Исполнитель | Зависимости | Статус |
|---|------|-------|-------------|-------------|--------|
| E1 | Инфраструктура | 4 | BE-LK | - | ✅ DONE |
| E2 | База данных | 5 | BE-LK | E1 | ✅ DONE |
| E3 | TBank Integration | 7 | INTEG-LK | E1 | ✅ DONE |
| E4 | Backend Services | 8 | BE-LK | E2, E3 | ✅ DONE |
| E5 | API Endpoints | 5 | BE-LK | E4 | ✅ DONE |
| E6 | Frontend | 5 | FE-LK | E5 | ✅ DONE |
| E7 | Тестирование | 4 | QA-LK | E5, E6 | 🔄 60% |
| E8 | Деплой и rollout | 3 | BE-LK + INTEG-LK | E7 | ⏳ TODO |

---

## E1: Инфраструктура

**Исполнитель:** BE-LK
**Зависимости:** нет

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E1.1 | Добавить новые пакеты в requirements.txt | S | P0 |
| E1.2 | Настроить Celery worker и beat | M | P0 |
| E1.3 | Добавить env переменные для TBank | S | P0 |
| E1.4 | Обновить docker-compose с celery | M | P0 |

### E1.1: Новые пакеты

```txt
# requirements.txt additions
httpx>=0.25.0
circuitbreaker>=2.0.0
tenacity>=8.0.0
celery>=5.3.0
redis>=5.0.0
```

**DoD:**
- [ ] Пакеты добавлены
- [ ] `pip install -r requirements.txt` работает
- [ ] Import не падает

### E1.2: Celery настройка

**Файлы:**
- `backend/app/worker.py` — celery app
- `backend/app/tasks/` — директория для задач

**DoD:**
- [ ] Celery worker запускается
- [ ] Celery beat запускается
- [ ] Тестовая задача выполняется

### E1.3: ENV переменные

```env
TBANK_API_URL=
TBANK_API_TOKEN=
TBANK_WEBHOOK_SECRET=
TBANK_NOMINAL_ACCOUNT=
CELERY_BROKER_URL=redis://localhost:6379/1
HOLD_PERIOD_MINUTES=60
```

**DoD:**
- [ ] `.env.example` обновлен
- [ ] `settings.py` читает переменные
- [ ] Валидация при старте

### E1.4: Docker Compose

**DoD:**
- [ ] `celery-worker` сервис добавлен
- [ ] `celery-beat` сервис добавлен
- [ ] `docker-compose up` запускает все

---

## E2: База данных

**Исполнитель:** BE-LK
**Зависимости:** E1

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E2.1 | Миграция: новые поля в lk_deals | M | P0 |
| E2.2 | Миграция: таблица deal_split_recipients | M | P0 |
| E2.3 | Миграция: таблица bank_events | M | P0 |
| E2.4 | Миграция: таблица deal_invoices | M | P0 |
| E2.5 | SQLAlchemy модели для новых таблиц | L | P0 |

### E2.1: Новые поля lk_deals

```sql
ALTER TABLE lk_deals ADD COLUMN payment_model VARCHAR(20) DEFAULT 'INSTANT_SPLIT';
ALTER TABLE lk_deals ADD COLUMN external_deal_id VARCHAR(255);
ALTER TABLE lk_deals ADD COLUMN hold_expires_at TIMESTAMP;
```

**DoD:**
- [ ] Миграция создана
- [ ] `alembic upgrade head` работает
- [ ] `alembic downgrade -1` работает

### E2.2: deal_split_recipients

См. DB_SCHEMA.md

**DoD:**
- [ ] Таблица создана
- [ ] Индексы добавлены
- [ ] FK constraints работают

### E2.3: bank_events

Immutable log событий от банка.

**DoD:**
- [ ] Таблица создана
- [ ] Индексы по deal_id, event_type
- [ ] Партиционирование (опционально)

### E2.4: deal_invoices

```sql
CREATE TABLE deal_invoices (
    id UUID PRIMARY KEY,
    deal_id UUID REFERENCES lk_deals(id),
    invoice_number VARCHAR(50) UNIQUE,
    amount NUMERIC(15,2),
    status VARCHAR(30),  -- draft, sent, paid, cancelled
    payment_link VARCHAR(500),
    payment_qr TEXT,
    external_payment_id VARCHAR(255),
    expires_at TIMESTAMP,
    paid_at TIMESTAMP,
    created_at TIMESTAMP
);
```

### E2.5: SQLAlchemy модели

**Файлы:**
- `backend/app/models/invoice.py`
- `backend/app/models/bank_event.py`
- Обновить `backend/app/models/deal.py`

**DoD:**
- [ ] Модели созданы
- [ ] Relationships настроены
- [ ] `__init__.py` экспортирует

---

## E3: TBank Integration

**Исполнитель:** INTEG-LK
**Зависимости:** E1

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E3.1 | Base TBankClient с retry/circuit breaker | L | P0 |
| E3.2 | TBankDealsClient | M | P0 |
| E3.3 | TBankPaymentsClient | M | P0 |
| E3.4 | TBankWebhookHandler | L | P0 |
| E3.5 | Webhook signature validation | S | P0 |
| E3.6 | ReconciliationJob (Celery task) | M | P1 |
| E3.7 | Тесты с моками для TBank | L | P1 |

### E3.1: Base TBankClient

**Файл:** `backend/app/integrations/tbank/client.py`

```python
class TBankClient:
    """Base HTTP client with retry and circuit breaker"""

    @circuit(failure_threshold=5, recovery_timeout=30)
    @retry(stop=stop_after_attempt(3), wait=wait_exponential())
    async def _request(self, method, endpoint, idempotency_key, **kwargs):
        ...
```

**DoD:**
- [ ] Retry с exponential backoff
- [ ] Circuit breaker
- [ ] Idempotency key в headers
- [ ] Логирование запросов/ответов
- [ ] Rate limit handling (429)

### E3.2: TBankDealsClient

**Файл:** `backend/app/integrations/tbank/deals.py`

**Методы:**
- `create_deal(account_number, idempotency_key)`
- `get_deal(deal_id)`
- `cancel_deal(deal_id, idempotency_key)`

**DoD:**
- [ ] Все методы реализованы
- [ ] Pydantic модели для request/response
- [ ] Обработка ошибок

### E3.3: TBankPaymentsClient

**Файл:** `backend/app/integrations/tbank/payments.py`

**Методы:**
- `init_payment(deal_id, amount, idempotency_key)`
- `get_payment_status(payment_id)`

**DoD:**
- [ ] Все методы реализованы
- [ ] Возвращает payment_link и QR

### E3.4: TBankWebhookHandler

**Файл:** `backend/app/integrations/tbank/webhooks.py`

**События:**
- `payment.pending`
- `payment.completed`
- `payment.failed`
- `payout.completed`

**DoD:**
- [ ] Handler для каждого типа события
- [ ] Сохранение в bank_events (первым!)
- [ ] Обновление статуса сделки
- [ ] Идемпотентность (проверка event_id)

### E3.5: Signature validation

```python
def verify_signature(body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**DoD:**
- [ ] Валидация подписи
- [ ] Reject при невалидной подписи
- [ ] Логирование попыток

### E3.6: ReconciliationJob

**Файл:** `backend/app/tasks/reconciliation.py`

```python
@celery.task
def reconcile_deals():
    """Сверка статусов с банком каждые 5 минут"""
    ...
```

**DoD:**
- [ ] Находит сделки с рассинхроном
- [ ] Запрашивает статус у банка
- [ ] Обновляет локальный статус
- [ ] Алерт при расхождении

### E3.7: Тесты TBank

**Файл:** `backend/tests/integrations/test_tbank.py`

**DoD:**
- [ ] Mock для HTTP запросов
- [ ] Тесты happy path
- [ ] Тесты error handling
- [ ] Coverage >= 80%

---

## E4: Backend Services

**Исполнитель:** BE-LK
**Зависимости:** E2, E3

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E4.1 | DealService: новый state machine | L | P0 |
| E4.2 | InvoiceService | L | P0 |
| E4.3 | SplitService | M | P0 |
| E4.4 | HoldPeriodJob (Celery task) | M | P0 |
| E4.5 | EventBus для domain events | M | P1 |
| E4.6 | NotificationService updates | S | P1 |
| E4.7 | AuditService updates | S | P1 |
| E4.8 | Тесты сервисов | L | P1 |

### E4.1: DealService

**Файл:** `backend/app/services/deal_service.py`

**Новые методы:**
- `send_for_signing(deal_id)`
- `mark_signed(deal_id)`
- `create_invoice(deal_id)` → вызывает InvoiceService
- `handle_payment_completed(deal_id)`
- `start_hold_period(deal_id)`
- `complete_deal(deal_id)`
- `dispute_deal(deal_id, reason)`

**DoD:**
- [ ] State machine реализована
- [ ] Валидация переходов
- [ ] Events публикуются
- [ ] Транзакционность

### E4.2: InvoiceService

**Файл:** `backend/app/services/invoice_service.py`

**Методы:**
- `create_invoice(deal_id)` → создает запись + вызывает TBank
- `get_payment_link(invoice_id)`
- `handle_payment_completed(invoice_id, payment_data)`
- `cancel_invoice(invoice_id)`

**DoD:**
- [ ] Создание счета
- [ ] Получение ссылки на оплату
- [ ] Обработка оплаты

### E4.3: SplitService

**Файл:** `backend/app/services/split_service.py`

**Методы:**
- `calculate_split(deal_id)` → возвращает суммы для каждого участника
- `validate_split(split_items)` → сумма = 100%
- `save_split_recipients(deal_id, split_items)`

**DoD:**
- [ ] Расчет сумм
- [ ] Валидация 100%
- [ ] Сохранение в deal_split_recipients

### E4.4: HoldPeriodJob

**Файл:** `backend/app/tasks/hold_period.py`

```python
@celery.task
def check_hold_expiry():
    """Проверка истечения холда каждую минуту"""
    expired = get_deals_with_expired_hold()
    for deal in expired:
        complete_deal(deal.id)
```

**DoD:**
- [ ] Находит сделки с истекшим холдом
- [ ] Вызывает complete_deal
- [ ] Логирование

### E4.5: EventBus

**Файл:** `backend/app/events/bus.py`

```python
class EventBus:
    async def publish(self, event: DomainEvent):
        for handler in self.handlers[event.type]:
            await handler(event)
```

**DoD:**
- [ ] Publish/Subscribe
- [ ] Async handlers
- [ ] Регистрация handlers

### E4.6-E4.8: Updates и тесты

**DoD:**
- [ ] NotificationService: новые шаблоны уведомлений
- [ ] AuditService: логирование новых событий
- [ ] Тесты: coverage >= 80%

---

## E5: API Endpoints

**Исполнитель:** BE-LK
**Зависимости:** E4

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E5.1 | POST /deals — обновить под новую модель | M | P0 |
| E5.2 | POST /deals/{id}/send-for-signing | M | P0 |
| E5.3 | POST /deals/{id}/create-invoice | M | P0 |
| E5.4 | POST /webhooks/tbank | M | P0 |
| E5.5 | GET /deals/{id} — расширить response | S | P0 |

### E5.1: POST /deals

**Файл:** `backend/app/api/v1/endpoints/deals.py`

**Изменения:**
- Добавить `split` в request body
- Возвращать `payment_model: "INSTANT_SPLIT"`

### E5.2: POST /deals/{id}/send-for-signing

**Response:**
```json
{
  "status": "signing",
  "signing_links": [
    {"party_id": "...", "role": "client", "link": "...", "expires_at": "..."}
  ]
}
```

### E5.3: POST /deals/{id}/create-invoice

**Precondition:** status == "signed"

**Response:**
```json
{
  "invoice_id": "...",
  "status": "invoiced",
  "payment_link": "https://...",
  "payment_qr": "data:image/png;base64,...",
  "expires_at": "..."
}
```

### E5.4: POST /webhooks/tbank

**Security:** Signature validation

**Response:** Always 200 OK

### E5.5: GET /deals/{id}

**Расширить response:**
- `invoice` object
- `split_recipients` array
- `timeline` array (история статусов)
- `hold_expires_at` (если в холде)

---

## E6: Frontend

**Исполнитель:** FE-LK
**Зависимости:** E5

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E6.1 | Компонент создания сделки с split | L | P0 |
| E6.2 | UI статусов сделки (новые) | M | P0 |
| E6.3 | Страница оплаты (payment link + QR) | M | P0 |
| E6.4 | Timeline компонент | M | P1 |
| E6.5 | Уведомления (toast) для событий | S | P1 |

### E6.1: Создание сделки

**Файл:** `frontend/src/app/(dashboard)/deals/new/page.tsx`

**Изменения:**
- Добавить секцию "Распределение комиссии"
- UI для добавления участников сплита
- Валидация: сумма = 100%

### E6.2: UI статусов

**Новые статусы:**
- `signing` — "Ожидает подписания"
- `signed` — "Подписан"
- `invoiced` — "Счет выставлен"
- `payment_pending` — "Ожидает оплаты"
- `paid` — "Оплачен"
- `hold_period` — "Период подтверждения"
- `completed` — "Завершена"

### E6.3: Страница оплаты

**Файл:** `frontend/src/app/(dashboard)/deals/[id]/pay/page.tsx`

**Элементы:**
- QR код
- Кнопка "Скопировать ссылку"
- Таймер до истечения
- Auto-refresh статуса

### E6.4: Timeline

Компонент для отображения истории сделки.

### E6.5: Уведомления

Toast при:
- Сделка подписана
- Оплата получена
- Сделка завершена

---

## E7: Тестирование

**Исполнитель:** QA-LK
**Зависимости:** E5, E6

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E7.1 | Unit тесты backend (pytest) | L | P0 |
| E7.2 | Integration тесты TBank (mock) | L | P0 |
| E7.3 | E2E тесты (Playwright) | L | P1 |
| E7.4 | Нагрузочное тестирование | M | P2 |

### E7.1: Unit тесты

**Coverage target:** >= 80%

**Области:**
- DealService state machine
- InvoiceService
- SplitService calculations
- Webhook handlers

### E7.2: Integration тесты

**Mock TBank API:**
- Happy path: create deal → pay → complete
- Error: payment failed → retry
- Error: webhook invalid signature

### E7.3: E2E тесты

**Сценарии:**
1. Создать сделку → подписать → выставить счет
2. Оплата (mock) → завершение
3. Отмена до оплаты
4. Оспаривание в период холда

---

## E8: Деплой и rollout

**Исполнитель:** BE-LK + INTEG-LK
**Зависимости:** E7

| ID | Задача | Размер | Приоритет |
|----|--------|--------|-----------|
| E8.1 | Feature flag реализация | M | P0 |
| E8.2 | Деплой на staging | M | P0 |
| E8.3 | Rollout план (поэтапный) | S | P0 |

### E8.1: Feature flag

```python
INSTANT_SPLIT_ENABLED = env.bool("INSTANT_SPLIT_ENABLED", False)
INSTANT_SPLIT_ORG_IDS = env.list("INSTANT_SPLIT_ORG_IDS", [])
```

### E8.2: Staging deploy

**Checklist:**
- [ ] Миграции применены
- [ ] Celery workers запущены
- [ ] Webhook endpoint доступен
- [ ] TBank sandbox credentials настроены

### E8.3: Rollout план

| Этап | % трафика | Критерий |
|------|-----------|----------|
| 1 | 1 агентство | 10 успешных сделок |
| 2 | 10% | 100 успешных сделок |
| 3 | 50% | 1000 успешных сделок |
| 4 | 100% | Стабильная работа |

---

## Критический путь

```
E1 (Infra) ──> E2 (DB) ──> E4 (Services) ──> E5 (API) ──> E7 (Tests)
     │              │
     │              v
     └────────> E3 (TBank) ────────────────────────────────────┘

                                          E5 ──> E6 (FE) ──> E7
```

**Параллельно можно:**
- E2 и E3 (после E1)
- E6 (после E5)

---

## Назначения

| Роль | Задачи |
|------|--------|
| **BE-LK** | E1, E2, E4, E5, E8.1, E8.2 |
| **INTEG-LK** | E3 |
| **FE-LK** | E6 |
| **QA-LK** | E7 |

---

## Оценка (примерная)

| Эпик | Story Points |
|------|--------------|
| E1 | 5 |
| E2 | 8 |
| E3 | 13 |
| E4 | 13 |
| E5 | 8 |
| E6 | 8 |
| E7 | 13 |
| E8 | 5 |
| **Total** | **73 SP** |

---

## Порядок выполнения (спринты)

### Sprint 1: Фундамент
- E1 (Инфраструктура)
- E2 (База данных)
- E3.1-E3.3 (TBank клиенты)

### Sprint 2: Core Logic
- E3.4-E3.7 (Webhooks, reconciliation)
- E4 (Backend Services)

### Sprint 3: API + FE
- E5 (API Endpoints)
- E6 (Frontend)

### Sprint 4: Testing + Deploy
- E7 (Тестирование)
- E8 (Деплой)

---

*Создано: 2026-01-16*
*Автор: TPM-LK*
