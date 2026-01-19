# Backlog: Bank-Led Safe Deal Architecture (Detailed)

**Дата создания:** 2026-01-19
**Версия:** 2.0 (Detailed)
**Статус:** Draft
**Фискализация:** Чеки Т-Бизнеса (1.5%)

---

## Сводка эпиков

| Epic | Задач | Подзадач | Приоритет |
|------|-------|----------|-----------|
| EPIC-1: Bank-Led Architecture | 3 | 24 | P0 |
| EPIC-2: Release by Event | 4 | 31 | P0 |
| EPIC-3: Fiscalization | 3 | 22 | P0 |
| EPIC-4: Legal Layer Restructure | 2 | 14 | P0 |
| EPIC-5: Merchant Onboarding | 3 | 25 | P0 |
| EPIC-6: Documentation Rewrite | 4 | 19 | P1 |
| **Итого** | **19** | **135** | — |

---

# EPIC-1: Bank-Led Architecture

**Цель:** Housler НЕ принимает деньги. Деньги всегда в контуре банка.

**Принцип:** Платформа только управляет lifecycle: `create → hold → confirm/release/cancel`

**Ключевые изменения:**
- Убрать все упоминания MoR
- Все денежные операции через T-Bank API
- Idempotency + Audit Trail для каждой операции

---

## TASK-1.1: Рефакторинг API create/confirm/cancel

**Приоритет:** P0 (блокер)
**Оценка:** 5 дней
**Тип:** Backend

### Описание

Переработать API для strict bank-led модели. Housler создаёт сделку в банке, получает `external_deal_id`, далее только управляет статусами.

### Подзадачи

#### 1.1.1 Модель данных

- [ ] **1.1.1.1** Добавить поле `Deal.external_deal_id: str` — ID сделки в T-Bank
- [ ] **1.1.1.2** Добавить поле `Deal.external_payment_url: str` — URL для оплаты
- [ ] **1.1.1.3** Добавить поле `Deal.bank_status: BankDealStatus` enum:
  ```python
  class BankDealStatus(str, Enum):
      NOT_CREATED = "not_created"
      CREATED = "created"
      PAYMENT_PENDING = "payment_pending"
      HOLD = "hold"
      RELEASED = "released"
      CANCELLED = "cancelled"
      REFUNDED = "refunded"
  ```
- [ ] **1.1.1.4** Добавить поле `Deal.bank_created_at: datetime`
- [ ] **1.1.1.5** Добавить поле `Deal.bank_released_at: datetime`
- [ ] **1.1.1.6** Миграция: `017_add_bank_deal_fields.py`

#### 1.1.2 Idempotency Layer

- [ ] **1.1.2.1** Создать модель `IdempotencyKey`:
  ```python
  class IdempotencyKey(Base):
      key: str (unique)
      operation: str  # create_deal, confirm_release, cancel
      deal_id: UUID
      request_hash: str
      response_json: JSON
      created_at: datetime
      expires_at: datetime
  ```
- [ ] **1.1.2.2** Миграция: `018_add_idempotency_keys.py`
- [ ] **1.1.2.3** Создать `IdempotencyService`:
  - `get_or_create(key, operation, deal_id)` — проверить/создать
  - `save_response(key, response)` — сохранить ответ
  - `cleanup_expired()` — очистка старых (Celery task)
- [ ] **1.1.2.4** Middleware для автоматической проверки `X-Idempotency-Key` header

#### 1.1.3 T-Bank Integration Service Refactor

- [ ] **1.1.3.1** Рефакторинг `TBankService.create_deal()`:
  ```python
  async def create_deal(
      deal: Deal,
      recipients: List[SplitRecipient],
      platform_fee: Decimal,
      idempotency_key: str
  ) -> TBankDealResponse:
      # POST /deals
      # Body: amount, description, recipients[], platform_fee
      # Header: X-Idempotency-Key
  ```
- [ ] **1.1.3.2** Рефакторинг `TBankService.confirm_release()`:
  ```python
  async def confirm_release(
      external_deal_id: str,
      idempotency_key: str
  ) -> TBankReleaseResponse:
      # POST /deals/{id}/release
  ```
- [ ] **1.1.3.3** Рефакторинг `TBankService.cancel_deal()`:
  ```python
  async def cancel_deal(
      external_deal_id: str,
      reason: str,
      idempotency_key: str
  ) -> TBankCancelResponse:
      # POST /deals/{id}/cancel
  ```
- [ ] **1.1.3.4** Добавить retry logic с exponential backoff:
  ```python
  @retry(
      stop=stop_after_attempt(3),
      wait=wait_exponential(multiplier=1, min=2, max=10),
      retry=retry_if_exception_type(TBankTemporaryError)
  )
  ```
- [ ] **1.1.3.5** Circuit breaker для T-Bank API (pybreaker)

#### 1.1.4 API Endpoints Update

- [ ] **1.1.4.1** `POST /bank-split` — после создания Deal вызывать `TBankService.create_deal()`
- [ ] **1.1.4.2** `POST /bank-split/{id}/release` — новый endpoint для manual release
- [ ] **1.1.4.3** `POST /bank-split/{id}/cancel` — обновить для вызова T-Bank
- [ ] **1.1.4.4** Добавить `X-Idempotency-Key` requirement в OpenAPI spec

### Критерии приёмки

- [ ] Все денежные операции проходят через T-Bank API
- [ ] Каждая операция имеет idempotency key
- [ ] Retry при временных ошибках (3 попытки)
- [ ] Circuit breaker срабатывает при 5 ошибках подряд
- [ ] `external_deal_id` сохраняется в Deal

---

## TASK-1.2: Webhook Handler Hardening

**Приоритет:** P0
**Оценка:** 3 дня
**Тип:** Backend

### Описание

Укрепить обработку webhooks: signature validation, idempotency, DLQ, reconciliation.

### Подзадачи

#### 1.2.1 Signature Validation

- [ ] **1.2.1.1** Добавить в config: `TBANK_WEBHOOK_SECRET: str`
- [ ] **1.2.1.2** Реализовать `verify_webhook_signature()`:
  ```python
  def verify_webhook_signature(
      payload: bytes,
      signature: str,
      secret: str
  ) -> bool:
      expected = hmac.new(
          secret.encode(),
          payload,
          hashlib.sha256
      ).hexdigest()
      return hmac.compare_digest(expected, signature)
  ```
- [ ] **1.2.1.3** Middleware: проверка `X-TBank-Signature` header
- [ ] **1.2.1.4** 401 Unauthorized при невалидной подписи
- [ ] **1.2.1.5** Логирование всех попыток с невалидной подписью (security alert)

#### 1.2.2 Idempotent Processing

- [ ] **1.2.2.1** Добавить `BankEvent.processed_at: datetime` (nullable)
- [ ] **1.2.2.2** Добавить `BankEvent.idempotency_key: str` (из webhook payload)
- [ ] **1.2.2.3** Миграция: `019_add_bank_event_fields.py`
- [ ] **1.2.2.4** При обработке webhook:
  ```python
  existing = await db.query(BankEvent).filter(
      BankEvent.idempotency_key == event.idempotency_key
  ).first()
  if existing and existing.processed_at:
      return {"status": "already_processed"}
  ```
- [ ] **1.2.2.5** После успешной обработки: `event.processed_at = datetime.utcnow()`

#### 1.2.3 Dead Letter Queue

- [ ] **1.2.3.1** Создать модель `WebhookDLQ`:
  ```python
  class WebhookDLQ(Base):
      id: UUID
      event_type: str
      payload: JSON
      error_message: str
      retry_count: int
      last_retry_at: datetime
      created_at: datetime
      resolved_at: datetime (nullable)
  ```
- [ ] **1.2.3.2** Миграция: `020_add_webhook_dlq.py`
- [ ] **1.2.3.3** При ошибке обработки → сохранять в DLQ
- [ ] **1.2.3.4** Celery task `retry_dlq_webhooks()` — повтор каждые 15 минут
- [ ] **1.2.3.5** Max retry = 5, после этого → alert + manual review
- [ ] **1.2.3.6** Admin endpoint `GET /admin/webhooks/dlq` — список failed
- [ ] **1.2.3.7** Admin endpoint `POST /admin/webhooks/dlq/{id}/retry` — manual retry

#### 1.2.4 Reconciliation

- [ ] **1.2.4.1** Celery task `reconcile_bank_statuses()`:
  ```python
  @celery.task
  def reconcile_bank_statuses():
      # Найти сделки в статусе HOLD более 1 часа
      # Запросить актуальный статус в T-Bank
      # Обновить локальный статус если расхождение
  ```
- [ ] **1.2.4.2** Запуск каждые 15 минут
- [ ] **1.2.4.3** Alert при расхождении статусов
- [ ] **1.2.4.4** Логирование всех reconciliation результатов

### Критерии приёмки

- [ ] Webhook без валидной подписи → 401
- [ ] Повторный webhook → 200 OK, no-op
- [ ] Failed webhook → DLQ + alert
- [ ] Reconciliation находит расхождения

---

## TASK-1.3: Remove MoR References

**Приоритет:** P1
**Оценка:** 1 день
**Тип:** Backend + Frontend

### Описание

Удалить все упоминания "MoR" (Merchant of Record) из кодовой базы.

### Подзадачи

#### 1.3.1 Backend Cleanup

- [ ] **1.3.1.1** Grep по `mor` / `MoR` / `merchant_of_record` в backend/
- [ ] **1.3.1.2** Удалить/переименовать enum если есть: `PaymentModel.MOR` → удалить
- [ ] **1.3.1.3** Обновить комментарии в коде
- [ ] **1.3.1.4** Обновить docstrings

#### 1.3.2 Frontend Cleanup

- [ ] **1.3.2.1** Grep по `mor` / `MoR` в frontend/
- [ ] **1.3.2.2** Обновить labels/texts
- [ ] **1.3.2.3** Обновить TypeScript types если есть

#### 1.3.3 API Responses

- [ ] **1.3.3.1** Проверить все API responses на наличие "mor"
- [ ] **1.3.3.2** Обновить Pydantic schemas если нужно

### Критерии приёмки

- [ ] `grep -ri "mor" backend/ frontend/` — 0 результатов (кроме "more", "morning" и т.п.)

---

# EPIC-2: Release by Event

**Цель:** Убрать автоматический релиз через 1 час. Релиз только по подтверждению события или по истечении периода без претензий.

**Модели релиза:**
1. **Manual** — уполномоченный нажимает "Release"
2. **Event-triggered** — подтверждение услуги → auto release
3. **Time-based** — N дней без претензий → auto release

---

## TASK-2.1: Configurable Hold Period

**Приоритет:** P0 (блокер)
**Оценка:** 3 дня
**Тип:** Backend

### Описание

Сделать период холда настраиваемым. Default: 72 часа для споров, 7 дней для auto-release.

### Подзадачи

#### 2.1.1 Модель данных

- [ ] **2.1.1.1** Добавить `Deal.hold_duration_hours: int` (default: 72)
- [ ] **2.1.1.2** Добавить `Deal.auto_release_days: int` (default: 7)
- [ ] **2.1.1.3** Добавить `Deal.hold_started_at: datetime`
- [ ] **2.1.1.4** Добавить `Deal.hold_expires_at: datetime` (computed)
- [ ] **2.1.1.5** Добавить `Deal.auto_release_at: datetime` (computed)
- [ ] **2.1.1.6** Миграция: `021_add_hold_period_fields.py`

#### 2.1.2 Config Settings

- [ ] **2.1.2.1** Добавить в `config.py`:
  ```python
  DEFAULT_HOLD_HOURS: int = 72
  DEFAULT_AUTO_RELEASE_DAYS: int = 7
  MIN_HOLD_HOURS: int = 24
  MAX_HOLD_HOURS: int = 168  # 7 дней
  MAX_AUTO_RELEASE_DAYS: int = 30
  ```
- [ ] **2.1.2.2** Валидация при создании сделки

#### 2.1.3 Business Logic

- [ ] **2.1.3.1** При webhook `HOLD_STARTED`:
  ```python
  deal.hold_started_at = datetime.utcnow()
  deal.hold_expires_at = deal.hold_started_at + timedelta(hours=deal.hold_duration_hours)
  deal.auto_release_at = deal.hold_started_at + timedelta(days=deal.auto_release_days)
  ```
- [ ] **2.1.3.2** Обновить `DealService.can_release()`:
  ```python
  def can_release(deal: Deal) -> bool:
      if deal.dispute_locked:
          return False
      if deal.hold_expires_at and datetime.utcnow() < deal.hold_expires_at:
          return False  # Ещё можно оспорить
      return True
  ```

#### 2.1.4 Celery Tasks Update

- [ ] **2.1.4.1** Обновить `process_hold_expiry()`:
  ```python
  @celery.task
  def process_auto_release():
      deals = Deal.query.filter(
          Deal.status == DealStatus.HOLD,
          Deal.auto_release_at <= datetime.utcnow(),
          Deal.dispute_locked == False
      ).all()
      for deal in deals:
          release_deal(deal)
  ```
- [ ] **2.1.4.2** Убрать старую логику "1 час auto release"
- [ ] **2.1.4.3** Добавить task `notify_hold_expiring()` — уведомление за 24 часа до auto-release

#### 2.1.5 API Updates

- [ ] **2.1.5.1** `POST /bank-split` — принимать `hold_duration_hours`, `auto_release_days`
- [ ] **2.1.5.2** `GET /bank-split/{id}` — возвращать `hold_expires_at`, `auto_release_at`
- [ ] **2.1.5.3** Обновить Pydantic schemas

#### 2.1.6 Frontend Updates

- [ ] **2.1.6.1** Форма создания сделки: опциональные поля hold period
- [ ] **2.1.6.2** Детали сделки: показать `hold_expires_at`, `auto_release_at`
- [ ] **2.1.6.3** Countdown до auto-release

### Критерии приёмки

- [ ] Hold period настраивается при создании (default 72h)
- [ ] Auto-release через N дней без претензий (default 7)
- [ ] Нельзя release до `hold_expires_at`
- [ ] UI показывает таймеры

---

## TASK-2.2: Release by Confirmation Event

**Приоритет:** P0
**Оценка:** 3 дня
**Тип:** Backend

### Описание

Подтверждение услуги (ServiceCompletion) может триггерить release.

### Подзадачи

#### 2.2.1 Модель данных

- [ ] **2.2.1.1** Добавить `ServiceCompletion.triggers_release: bool` (default: True)
- [ ] **2.2.1.2** Добавить `ServiceCompletion.release_triggered_at: datetime`
- [ ] **2.2.1.3** Миграция: `022_add_completion_release_fields.py`

#### 2.2.2 Release Trigger Logic

- [ ] **2.2.2.1** Обновить `confirm_service_completion()`:
  ```python
  async def confirm_service_completion(
      deal_id: UUID,
      user_id: int,
      evidence_file_ids: List[UUID],
      notes: str,
      trigger_release: bool = True
  ):
      completion = ServiceCompletion(...)

      if trigger_release and not deal.dispute_locked:
          if datetime.utcnow() >= deal.hold_expires_at:
              # Hold period прошёл, можно release
              await tbank_service.confirm_release(deal.external_deal_id)
              completion.release_triggered_at = datetime.utcnow()
              deal.status = DealStatus.RELEASED
          else:
              # Hold ещё активен, schedule release на hold_expires_at
              schedule_release_at(deal, deal.hold_expires_at)
  ```
- [ ] **2.2.2.2** Если есть открытый спор → отклонить подтверждение
- [ ] **2.2.2.3** Уведомить всех участников о подтверждении

#### 2.2.3 RBAC для подтверждения

- [ ] **2.2.3.1** Определить кто может подтверждать:
  ```python
  COMPLETION_ALLOWED_ROLES = {
      "agent": ["agent", "agency_admin"],
      "agency": ["agency_admin", "agency_tl"],
      "platform": ["admin", "operator"]
  }
  ```
- [ ] **2.2.3.2** Проверка в endpoint:
  ```python
  if not can_confirm_completion(user, deal):
      raise HTTPException(403, "Not authorized to confirm")
  ```
- [ ] **2.2.3.3** Конфигурируемо на уровне агентства

#### 2.2.4 Evidence Pack

- [ ] **2.2.4.1** Добавить `ServiceCompletion.evidence_required: bool` (настраивается при создании deal)
- [ ] **2.2.4.2** Минимальные требования к evidence:
  ```python
  MIN_EVIDENCE_REQUIREMENTS = {
      "sale": ["contract", "act"],
      "rent": ["contract"],
  }
  ```
- [ ] **2.2.4.3** Валидация при подтверждении:
  ```python
  if deal.evidence_required:
      if not evidence_file_ids or len(evidence_file_ids) < min_required:
          raise HTTPException(400, "Evidence required")
  ```

#### 2.2.5 Notifications

- [ ] **2.2.5.1** SMS/Email агенту: "Услуга подтверждена, выплата запланирована"
- [ ] **2.2.5.2** SMS/Email клиенту: "Исполнитель подтвердил оказание услуги"
- [ ] **2.2.5.3** Уведомление при scheduled release

#### 2.2.6 API & Frontend

- [ ] **2.2.6.1** Обновить `POST /bank-split/{id}/confirm-completion` — добавить `trigger_release` param
- [ ] **2.2.6.2** UI: checkbox "Запросить выплату после подтверждения"
- [ ] **2.2.6.3** UI: показать статус "Выплата запланирована на {date}"

### Критерии приёмки

- [ ] Подтверждение услуги → release (если нет споров)
- [ ] Нельзя подтвердить при открытом споре
- [ ] RBAC работает
- [ ] Evidence валидируется если required
- [ ] Уведомления отправляются

---

## TASK-2.3: Dispute Lock Mechanism

**Приоритет:** P0
**Оценка:** 3 дня
**Тип:** Backend

### Описание

Открытый спор блокирует release. Разрешение спора снимает блок.

### Подзадачи

#### 2.3.1 Модель данных

- [ ] **2.3.1.1** Добавить `Deal.dispute_locked: bool` (default: False)
- [ ] **2.3.1.2** Добавить `Deal.dispute_locked_at: datetime`
- [ ] **2.3.1.3** Добавить `Deal.dispute_lock_reason: str`
- [ ] **2.3.1.4** Миграция: `023_add_dispute_lock_fields.py`

#### 2.3.2 Lock on Dispute Create

- [ ] **2.3.2.1** При создании спора:
  ```python
  async def create_dispute(deal_id, reason, description):
      # Проверить что можно открыть спор
      if deal.status not in [DealStatus.HOLD, DealStatus.PAYMENT_RECEIVED]:
          raise HTTPException(400, "Cannot dispute at this stage")

      dispute = Dispute(...)
      deal.dispute_locked = True
      deal.dispute_locked_at = datetime.utcnow()
      deal.dispute_lock_reason = f"Dispute #{dispute.id}: {reason}"
      deal.status = DealStatus.DISPUTE

      # Отменить scheduled release если был
      cancel_scheduled_release(deal)
  ```
- [ ] **2.3.2.2** Уведомить всех участников о споре
- [ ] **2.3.2.3** Уведомить T-Bank о hold extension (если API поддерживает)

#### 2.3.3 Unlock on Resolution

- [ ] **2.3.3.1** При resolution спора:
  ```python
  async def resolve_dispute(dispute_id, resolution, resolution_notes):
      dispute.status = DisputeStatus.RESOLVED
      dispute.resolution = resolution
      deal.dispute_locked = False

      if resolution == "release":
          await tbank_service.confirm_release(deal.external_deal_id)
          deal.status = DealStatus.RELEASED
      elif resolution == "refund":
          await tbank_service.refund(deal.external_deal_id)
          deal.status = DealStatus.REFUNDED
      elif resolution == "partial_refund":
          await tbank_service.partial_refund(deal.external_deal_id, amount)
  ```

#### 2.3.4 Dispute Timers

- [ ] **2.3.4.1** Добавить `Dispute.agency_deadline: datetime` (24h после создания)
- [ ] **2.3.4.2** Добавить `Dispute.platform_deadline: datetime` (72h после эскалации)
- [ ] **2.3.4.3** Добавить `Dispute.max_deadline: datetime` (7 дней от создания)
- [ ] **2.3.4.4** Celery task `check_dispute_deadlines()`:
  ```python
  @celery.task
  def check_dispute_deadlines():
      # Автоэскалация если agency не решило за 24h
      overdue_agency = Dispute.query.filter(
          Dispute.status == DisputeStatus.OPEN,
          Dispute.agency_deadline <= datetime.utcnow()
      )
      for dispute in overdue_agency:
          escalate_to_platform(dispute)

      # Авторешение если platform не решила за 72h
      overdue_platform = Dispute.query.filter(
          Dispute.escalation_level == "platform",
          Dispute.platform_deadline <= datetime.utcnow()
      )
      for dispute in overdue_platform:
          auto_resolve_in_favor_of_client(dispute)  # Default: refund
  ```
- [ ] **2.3.4.5** Уведомления о приближающихся дедлайнах

#### 2.3.5 Escalation Flow

- [ ] **2.3.5.1** `POST /disputes/{id}/escalate` — ручная эскалация клиентом
- [ ] **2.3.5.2** Автоэскалация по таймеру (см. выше)
- [ ] **2.3.5.3** При эскалации:
  ```python
  dispute.escalation_level = "platform"
  dispute.escalated_at = datetime.utcnow()
  dispute.platform_deadline = datetime.utcnow() + timedelta(hours=72)
  ```
- [ ] **2.3.5.4** Уведомить admin team о новой эскалации

#### 2.3.6 Release Block Validation

- [ ] **2.3.6.1** Во всех местах release проверять:
  ```python
  if deal.dispute_locked:
      raise HTTPException(400, "Cannot release: dispute in progress")
  ```
- [ ] **2.3.6.2** В T-Bank service:
  ```python
  async def confirm_release(external_deal_id):
      deal = get_deal_by_external_id(external_deal_id)
      if deal.dispute_locked:
          raise DisputeLockError("Release blocked by dispute")
  ```

### Критерии приёмки

- [ ] Спор → `dispute_locked = True`
- [ ] `dispute_locked` → release невозможен
- [ ] Resolution → снять lock + release/refund
- [ ] Таймеры работают (24h agency, 72h platform)
- [ ] Автоэскалация при просрочке

---

## TASK-2.4: Two-Stage Payment (Milestone)

**Приоритет:** P2
**Оценка:** 5 дней
**Тип:** Backend + Frontend

### Описание

Разделение платежа на этапы: аванс (Milestone A) релизится быстро, остаток (Milestone B) — по событию.

### Подзадачи

#### 2.4.1 Модель данных

- [ ] **2.4.1.1** Расширить `DealMilestone`:
  ```python
  class DealMilestone(Base):
      id: UUID
      deal_id: UUID
      name: str  # "Аванс", "Остаток"
      amount: Decimal
      percent: Decimal  # Альтернатива amount
      sequence: int  # 1, 2, ...
      release_trigger: ReleaseTrigger  # IMMEDIATE, SHORT_HOLD, CONFIRMATION, DATE
      release_delay_hours: int  # Для SHORT_HOLD
      release_date: datetime  # Для DATE
      status: MilestoneStatus  # PENDING, PAID, RELEASED, REFUNDED
      paid_at: datetime
      released_at: datetime
      external_payout_id: str
  ```
- [ ] **2.4.1.2** Enum `ReleaseTrigger`:
  ```python
  class ReleaseTrigger(str, Enum):
      IMMEDIATE = "immediate"  # Release сразу после оплаты
      SHORT_HOLD = "short_hold"  # Через N часов
      CONFIRMATION = "confirmation"  # По подтверждению
      DATE = "date"  # В конкретную дату
  ```
- [ ] **2.4.1.3** Миграция: `024_extend_deal_milestones.py`

#### 2.4.2 T-Bank Partial Release

- [ ] **2.4.2.1** Изучить T-Bank API для partial release
- [ ] **2.4.2.2** Реализовать `TBankService.partial_release()`:
  ```python
  async def partial_release(
      external_deal_id: str,
      amount: Decimal,
      recipient_splits: Dict[str, Decimal],
      idempotency_key: str
  )
  ```
- [ ] **2.4.2.3** Если T-Bank не поддерживает partial → эмулировать через отдельные deals

#### 2.4.3 Milestone Release Logic

- [ ] **2.4.3.1** При оплате milestone:
  ```python
  if milestone.release_trigger == ReleaseTrigger.IMMEDIATE:
      await release_milestone(milestone)
  elif milestone.release_trigger == ReleaseTrigger.SHORT_HOLD:
      schedule_release(milestone, delay_hours=milestone.release_delay_hours)
  # CONFIRMATION и DATE обрабатываются отдельно
  ```
- [ ] **2.4.3.2** `release_milestone()` — partial release через T-Bank
- [ ] **2.4.3.3** Celery task для scheduled milestone releases

#### 2.4.4 API & Frontend

- [ ] **2.4.4.1** `POST /bank-split` — принимать `milestones[]` array
- [ ] **2.4.4.2** `GET /bank-split/{id}/milestones` — список milestones с статусами
- [ ] **2.4.4.3** `POST /bank-split/{id}/milestones/{mid}/release` — manual release
- [ ] **2.4.4.4** UI: настройка milestones при создании сделки
- [ ] **2.4.4.5** UI: progress bar с milestones на странице сделки
- [ ] **2.4.4.6** UI: кнопка release для каждого milestone

### Критерии приёмки

- [ ] Можно создать сделку с 2+ milestones
- [ ] Каждый milestone релизится независимо
- [ ] IMMEDIATE milestone релизится сразу
- [ ] SHORT_HOLD milestone релизится через N часов
- [ ] CONFIRMATION milestone ждёт подтверждения

---

# EPIC-3: Fiscalization (Чеки Т-Бизнеса)

**Цель:** ИП/ООО выдают кассовый чек 54-ФЗ через "Чеки Т-Бизнеса" (1.5% с платежа).

**Важно:**
- Самозанятый (НПД) = чек НПД, не 54-ФЗ
- ИП/ООО = кассовый чек 54-ФЗ через Чеки Т-Бизнеса

---

## TASK-3.1: Fiscalization Infrastructure

**Приоритет:** P0
**Оценка:** 2 дня
**Тип:** Backend

### Описание

Базовая инфраструктура для фискализации: модели, настройки, выбор метода.

### Подзадачи

#### 3.1.1 Модель данных

- [ ] **3.1.1.1** Добавить enum `FiscalizationMethod`:
  ```python
  class FiscalizationMethod(str, Enum):
      NPD_RECEIPT = "npd_receipt"  # Самозанятый — чек НПД
      TBANK_CHECKS = "tbank_checks"  # Чеки Т-Бизнеса (1.5%)
      EXTERNAL = "external"  # Своя касса (вне Housler)
      NOT_REQUIRED = "not_required"  # Юрлица без розницы
  ```
- [ ] **3.1.1.2** Добавить в PaymentProfile:
  ```python
  fiscalization_method: FiscalizationMethod
  tbank_checks_enabled: bool
  tbank_checks_merchant_id: str  # ID в системе Чеки
  ```
- [ ] **3.1.1.3** Создать модель `FiscalReceipt`:
  ```python
  class FiscalReceipt(Base):
      id: UUID
      deal_id: UUID
      recipient_id: UUID
      method: FiscalizationMethod
      amount: Decimal
      status: ReceiptStatus  # PENDING, CREATED, SENT, ERROR
      external_receipt_id: str
      receipt_url: str
      fiscal_data: JSON  # ФН, ФД, ФП
      error_message: str
      created_at: datetime
      fiscalized_at: datetime
  ```
- [ ] **3.1.1.4** Миграция: `025_add_fiscalization.py`

#### 3.1.2 Auto-Detection Logic

- [ ] **3.1.2.1** Определение метода фискализации при onboarding:
  ```python
  def determine_fiscalization_method(profile: PaymentProfile) -> FiscalizationMethod:
      if profile.legal_type == LegalType.SE:
          return FiscalizationMethod.NPD_RECEIPT
      elif profile.legal_type in [LegalType.IP, LegalType.OOO]:
          if profile.tbank_checks_enabled:
              return FiscalizationMethod.TBANK_CHECKS
          else:
              return FiscalizationMethod.EXTERNAL
      return FiscalizationMethod.NOT_REQUIRED
  ```
- [ ] **3.1.2.2** Рекомендация при onboarding:
  ```
  ИП/ООО: "Рекомендуем Чеки Т-Бизнеса (1.5% с платежа, без аренды кассы)"
  ```

#### 3.1.3 Config Settings

- [ ] **3.1.3.1** Добавить в config:
  ```python
  TBANK_CHECKS_API_URL: str
  TBANK_CHECKS_API_KEY: str
  TBANK_CHECKS_INN: str  # ИНН Housler для agency fee
  FISCALIZATION_REQUIRED: bool = True
  ```

### Критерии приёмки

- [ ] Модели созданы
- [ ] Auto-detection работает
- [ ] Config настроен

---

## TASK-3.2: T-Bank Checks Integration

**Приоритет:** P0
**Оценка:** 5 дней
**Тип:** Backend

### Описание

Интеграция с API "Чеки Т-Бизнеса" для автоматической фискализации при release.

### Подзадачи

#### 3.2.1 T-Bank Checks API Client

- [ ] **3.2.1.1** Изучить документацию "Чеки Т-Бизнеса" API
- [ ] **3.2.1.2** Создать `TBankChecksClient`:
  ```python
  class TBankChecksClient:
      def __init__(self, api_url: str, api_key: str):
          self.api_url = api_url
          self.api_key = api_key

      async def create_receipt(
          self,
          merchant_id: str,
          amount: Decimal,
          description: str,
          customer_contact: str,  # email или телефон
          items: List[ReceiptItem],
          idempotency_key: str
      ) -> CreateReceiptResponse:
          """POST /receipts"""
          pass

      async def get_receipt_status(
          self,
          receipt_id: str
      ) -> ReceiptStatusResponse:
          """GET /receipts/{id}"""
          pass

      async def get_receipt_url(
          self,
          receipt_id: str
      ) -> str:
          """Получить URL для скачивания чека"""
          pass
  ```
- [ ] **3.2.1.3** Модели request/response:
  ```python
  class ReceiptItem(BaseModel):
      name: str
      price: Decimal
      quantity: int = 1
      vat: VATRate  # НДС 0%, 10%, 20%
      payment_method: PaymentMethod  # full_payment, advance, etc.
      payment_object: PaymentObject  # service, etc.
  ```
- [ ] **3.2.1.4** Error handling + retry logic

#### 3.2.2 Fiscalization Service

- [ ] **3.2.2.1** Создать `FiscalizationService`:
  ```python
  class FiscalizationService:
      async def fiscalize_payout(
          self,
          deal: Deal,
          recipient: DealSplitRecipient,
          amount: Decimal
      ) -> FiscalReceipt:
          profile = await get_payment_profile(recipient)

          if profile.fiscalization_method == FiscalizationMethod.TBANK_CHECKS:
              return await self._fiscalize_tbank_checks(deal, recipient, amount, profile)
          elif profile.fiscalization_method == FiscalizationMethod.NPD_RECEIPT:
              return await self._create_npd_reminder(deal, recipient, amount)
          else:
              return None  # External or not required

      async def _fiscalize_tbank_checks(self, deal, recipient, amount, profile):
          items = [ReceiptItem(
              name=f"Услуги по сделке #{deal.id[:8]}",
              price=amount,
              vat=VATRate.NONE if profile.legal_type == LegalType.IP_USN else VATRate.VAT_20,
              payment_method=PaymentMethod.FULL_PAYMENT,
              payment_object=PaymentObject.SERVICE
          )]

          response = await self.tbank_checks.create_receipt(
              merchant_id=profile.tbank_checks_merchant_id,
              amount=amount,
              description=f"Комиссия по сделке {deal.id}",
              customer_contact=deal.client_email or deal.client_phone,
              items=items,
              idempotency_key=f"fiscal-{deal.id}-{recipient.id}"
          )

          receipt = FiscalReceipt(
              deal_id=deal.id,
              recipient_id=recipient.id,
              method=FiscalizationMethod.TBANK_CHECKS,
              amount=amount,
              status=ReceiptStatus.CREATED,
              external_receipt_id=response.receipt_id
          )
          return receipt
  ```
- [ ] **3.2.2.2** Retry при временных ошибках
- [ ] **3.2.2.3** Alert при постоянных ошибках

#### 3.2.3 Auto-Fiscalization on Release

- [ ] **3.2.3.1** Интеграция в release flow:
  ```python
  async def on_deal_released(deal: Deal):
      for recipient in deal.split_recipients:
          if recipient.payout_amount > 0:
              try:
                  receipt = await fiscalization_service.fiscalize_payout(
                      deal, recipient, recipient.payout_amount
                  )
                  if receipt:
                      recipient.fiscal_receipt_id = receipt.id
              except FiscalizationError as e:
                  logger.error(f"Fiscalization failed: {e}")
                  # Не блокируем release, но логируем
                  create_fiscalization_alert(deal, recipient, e)
  ```
- [ ] **3.2.3.2** Celery task для retry failed fiscalizations:
  ```python
  @celery.task
  def retry_failed_fiscalizations():
      failed = FiscalReceipt.query.filter(
          FiscalReceipt.status == ReceiptStatus.ERROR,
          FiscalReceipt.created_at >= datetime.utcnow() - timedelta(hours=24)
      )
      for receipt in failed:
          try:
              await fiscalization_service.retry(receipt)
          except:
              pass  # Будет в следующем цикле
  ```

#### 3.2.4 Webhook Handler

- [ ] **3.2.4.1** Endpoint для webhooks от Чеки Т-Бизнеса (если есть):
  ```python
  @router.post("/webhooks/tbank-checks")
  async def handle_checks_webhook(payload: dict):
      receipt_id = payload.get("receipt_id")
      status = payload.get("status")

      receipt = await get_receipt(receipt_id)
      receipt.status = map_status(status)

      if status == "fiscalized":
          receipt.fiscalized_at = datetime.utcnow()
          receipt.fiscal_data = payload.get("fiscal_data")
          receipt.receipt_url = payload.get("receipt_url")
  ```
- [ ] **3.2.4.2** Signature validation для webhook

#### 3.2.5 Receipt URL & Notifications

- [ ] **3.2.5.1** После успешной фискализации — отправить чек клиенту:
  ```python
  async def send_receipt_to_client(receipt: FiscalReceipt, deal: Deal):
      if deal.client_email:
          await email_service.send_receipt(deal.client_email, receipt.receipt_url)
      if deal.client_phone:
          await sms_service.send(
              deal.client_phone,
              f"Ваш чек по сделке: {receipt.receipt_url}"
          )
  ```
- [ ] **3.2.5.2** Ссылка на чек в UI сделки

#### 3.2.6 API & Frontend

- [ ] **3.2.6.1** `GET /bank-split/{id}/receipts` — список чеков по сделке
- [ ] **3.2.6.2** `GET /receipts/{id}` — детали чека
- [ ] **3.2.6.3** UI: секция "Чеки" на странице сделки
- [ ] **3.2.6.4** UI: кнопка "Скачать чек"

### Критерии приёмки

- [ ] Чек создаётся автоматически при release для ИП/ООО с TBANK_CHECKS
- [ ] Ссылка на чек доступна в UI
- [ ] Чек отправляется клиенту (email/SMS)
- [ ] Ошибки логируются и ретраятся

---

## TASK-3.3: NPD Receipt Tracking

**Приоритет:** P1
**Оценка:** 2 дня
**Тип:** Backend

### Описание

Отслеживание чеков НПД для самозанятых. Напоминание сформировать чек.

### Подзадачи

#### 3.3.1 Reminder Flow

- [ ] **3.3.1.1** После release для самозанятого:
  ```python
  async def on_se_payout_released(deal: Deal, recipient: DealSplitRecipient):
      # Создать запись ожидания чека
      receipt = FiscalReceipt(
          deal_id=deal.id,
          recipient_id=recipient.id,
          method=FiscalizationMethod.NPD_RECEIPT,
          amount=recipient.payout_amount,
          status=ReceiptStatus.PENDING  # Ждём от самозанятого
      )

      # Отправить напоминание
      await sms_service.send(
          recipient.phone,
          f"Вам поступила выплата {amount} руб. Не забудьте сформировать чек НПД в приложении 'Мой налог'"
      )
  ```
- [ ] **3.3.1.2** Повторное напоминание через 24 часа если чек не загружен

#### 3.3.2 Manual Receipt Upload

- [ ] **3.3.2.1** API endpoint для загрузки ссылки на чек:
  ```python
  @router.post("/bank-split/{id}/npd-receipt")
  async def upload_npd_receipt(
      deal_id: UUID,
      receipt_url: str,
      user: User = Depends(get_current_user)
  ):
      # Проверить что user — получатель
      receipt = await get_pending_npd_receipt(deal_id, user.id)
      receipt.receipt_url = receipt_url
      receipt.status = ReceiptStatus.UPLOADED
      receipt.fiscalized_at = datetime.utcnow()
  ```
- [ ] **3.3.2.2** UI: форма для ввода ссылки на чек НПД
- [ ] **3.3.2.3** Валидация URL (должен быть lknpd.nalog.ru или npd.nalog.ru)

#### 3.3.3 Tracking Dashboard

- [ ] **3.3.3.1** Для самозанятого: список сделок с pending чеками
- [ ] **3.3.3.2** Статус: "Чек не загружен", "Чек загружен"
- [ ] **3.3.3.3** Warning если чек не загружен более 3 дней

### Критерии приёмки

- [ ] Напоминание отправляется после release
- [ ] Самозанятый может загрузить ссылку на чек
- [ ] Статус чека отображается в UI

---

# EPIC-4: Legal Layer Restructure

**Цель:** Два договорных слоя: B2C (Исполнитель-Клиент) и B2B (Housler-Исполнитель).

**Принцип:** Housler — ИТ-платформа, получает B2B вознаграждение за услуги, а не "комиссию с платежа".

---

## TASK-4.1: Contract Layer Separation

**Приоритет:** P0 (юридический)
**Оценка:** 3 дня
**Тип:** Documentation + Backend

### Описание

Разделить договорную структуру на два слоя и обновить все шаблоны.

### Подзадачи

#### 4.1.1 Слой 1: B2C/B2B Услуга (Исполнитель → Клиент)

- [ ] **4.1.1.1** Обновить TPL-001 (Покупка):
  - Убрать: "платформа принимает оплату"
  - Добавить: "Оплата осуществляется через платёжную систему АО «Т-Банк». Денежные средства удерживаются банком до момента подтверждения оказания услуги."
- [ ] **4.1.1.2** Обновить TPL-002 (Продажа) — аналогично
- [ ] **4.1.1.3** Обновить TPL-003 (Аренда) — аналогично
- [ ] **4.1.1.4** Обновить TPL-004 (Эксклюзивный) — аналогично
- [ ] **4.1.1.5** Обновить TPL-005 (Со-агент):
  - Добавить: "Стороны поручают банку распределить комиссию согласно указанным долям"
- [ ] **4.1.1.6** Ревью юристом всех обновлённых шаблонов

#### 4.1.2 Слой 2: B2B ИТ-услуги (Housler → Исполнитель)

- [ ] **4.1.2.1** Создать новый шаблон TPL-007 "Оферта на ИТ-услуги Housler":
  ```
  1. Предмет: Housler предоставляет ИТ-платформу для управления сделками
  2. Стоимость: Вознаграждение = 4% от комиссии Исполнителя
  3. Порядок оплаты: Исполнитель поручает банку удержать Вознаграждение
     из поступлений по сделке и перечислить на расчётный счёт Housler
  4. Housler НЕ является стороной договора с Клиентом
  5. Housler НЕ принимает денежные средства Клиента
  ```
- [ ] **4.1.2.2** Добавить модель `PlatformAgreement`:
  ```python
  class PlatformAgreement(Base):
      id: UUID
      user_id: int
      organization_id: UUID
      version: str
      accepted_at: datetime
      ip_address: str
      user_agent: str
  ```
- [ ] **4.1.2.3** Миграция: `026_add_platform_agreement.py`
- [ ] **4.1.2.4** При первом создании сделки требовать принятие оферты

#### 4.1.3 Поручение банку

- [ ] **4.1.3.1** Добавить в оферту пункт о поручении:
  ```
  Исполнитель настоящим поручает АО «Т-Банк» удержать из денежных средств,
  поступающих по сделкам, вознаграждение Площадки в размере, указанном
  в настройках сделки, и перечислить его на расчётный счёт ООО «Хауслер».
  ```
- [ ] **4.1.3.2** Это делает комиссию Housler "платежом Исполнителя в адрес Housler"
- [ ] **4.1.3.3** Ревью юристом

#### 4.1.4 Template Engine Update

- [ ] **4.1.4.1** Обновить Jinja templates в `contract_templates.py`
- [ ] **4.1.4.2** Добавить новые placeholders:
  - `{{ bank_name }}` = "АО «Т-Банк»"
  - `{{ payment_method }}` = "через платёжную систему банка"
  - `{{ hold_description }}` = "удерживаются банком до подтверждения"
- [ ] **4.1.4.3** Regenerate sample contracts для тестирования

### Критерии приёмки

- [ ] Все 6 шаблонов обновлены
- [ ] Оферта B2B создана (TPL-007)
- [ ] Юрист подтвердил тексты
- [ ] Нет упоминаний "платформа принимает"

---

## TASK-4.2: Consent Flow Update

**Приоритет:** P1
**Оценка:** 2 дня
**Тип:** Backend + Frontend

### Описание

Обновить consent flow для соответствия B2B структуре.

### Подзадачи

#### 4.2.1 Consent Types Update

- [ ] **4.2.1.1** Переименовать `PLATFORM_COMMISSION`:
  ```python
  # Было
  PLATFORM_COMMISSION = "platform_commission"

  # Стало
  PLATFORM_FEE_DEDUCTION = "platform_fee_deduction"
  ```
- [ ] **4.2.1.2** Обновить текст согласия:
  ```
  Было: "Согласен на комиссию платформы 4%"
  Стало: "Поручаю банку удержать вознаграждение Площадки (4% от моей комиссии)
          из поступлений по сделке и перечислить на счёт ООО «Хауслер»"
  ```
- [ ] **4.2.1.3** Добавить новый consent type:
  ```python
  PLATFORM_TERMS = "platform_terms"  # Принятие оферты ИТ-услуг
  ```

#### 4.2.2 Consent Recording

- [ ] **4.2.2.1** Убедиться что записывается:
  - IP address
  - Timestamp
  - User-Agent
  - Consent text version
- [ ] **4.2.2.2** Добавить `DealConsent.consent_text_hash: str` — хэш текста согласия

#### 4.2.3 UI Updates

- [ ] **4.2.3.1** Обновить текст checkbox в форме создания сделки
- [ ] **4.2.3.2** Добавить ссылку на оферту B2B
- [ ] **4.2.3.3** При первом использовании показать full-screen agreement acceptance

#### 4.2.4 Migration

- [ ] **4.2.4.1** Миграция для переименования consent type (если нужно)
- [ ] **4.2.4.2** Не ломать существующие записи

### Критерии приёмки

- [ ] Текст согласия обновлён
- [ ] Ссылка на оферту есть
- [ ] Consent записывается с полными данными

---

# EPIC-5: Merchant Onboarding

**Цель:** Единый onboarding: Housler Profile → Bank KYC → Fiscalization setup.

**Flow:**
1. Регистрация в Housler
2. Создание Payment Profile (реквизиты)
3. Bank onboarding (KYC)
4. Выбор фискализации
5. Ready to receive payments

---

## TASK-5.1: Payment Profile Model

**Приоритет:** P0
**Оценка:** 2 дня
**Тип:** Backend

### Описание

Расширенный профиль для приёма платежей с bank integration.

### Подзадачи

#### 5.1.1 Модель данных

- [ ] **5.1.1.1** Создать модель `PaymentProfile`:
  ```python
  class PaymentProfile(Base):
      id: UUID

      # Owner
      user_id: int (nullable)  # Для агента-физлица/СМЗ
      organization_id: UUID (nullable)  # Для ИП/ООО

      # Legal info
      legal_type: LegalType  # SE, IP, OOO
      legal_name: str
      inn: str (encrypted)
      kpp: str (nullable, encrypted)  # Только для ООО
      ogrn: str (nullable)

      # Bank details
      bank_account: str (encrypted)
      bank_bik: str
      bank_name: str
      bank_corr_account: str

      # Bank integration
      bank_onboarding_status: OnboardingStatus
      bank_merchant_id: str  # External ID в T-Bank
      bank_onboarded_at: datetime

      # Fiscalization
      fiscalization_method: FiscalizationMethod
      tbank_checks_enabled: bool
      tbank_checks_merchant_id: str

      # KYC
      kyc_status: KYCStatus  # PENDING, IN_PROGRESS, APPROVED, REJECTED
      kyc_submitted_at: datetime
      kyc_approved_at: datetime
      kyc_rejection_reason: str

      # Metadata
      is_active: bool
      created_at: datetime
      updated_at: datetime
  ```
- [ ] **5.1.1.2** Enum `OnboardingStatus`:
  ```python
  class OnboardingStatus(str, Enum):
      NOT_STARTED = "not_started"
      DOCUMENTS_REQUIRED = "documents_required"
      PENDING_REVIEW = "pending_review"
      APPROVED = "approved"
      REJECTED = "rejected"
  ```
- [ ] **5.1.1.3** Enum `KYCStatus`:
  ```python
  class KYCStatus(str, Enum):
      NOT_STARTED = "not_started"
      DOCUMENTS_UPLOADED = "documents_uploaded"
      IN_REVIEW = "in_review"
      APPROVED = "approved"
      REJECTED = "rejected"
      EXPIRED = "expired"
  ```
- [ ] **5.1.1.4** Миграция: `027_add_payment_profile.py`

#### 5.1.2 Encryption

- [ ] **5.1.2.1** Шифровать sensitive fields: inn, kpp, bank_account
- [ ] **5.1.2.2** Использовать существующий `ENCRYPTION_KEY`
- [ ] **5.1.2.3** Добавить `_encrypted` suffix для clarity

#### 5.1.3 Validation

- [ ] **5.1.3.1** Валидация ИНН (уже есть INNValidationService)
- [ ] **5.1.3.2** Валидация БИК (9 цифр, начинается с 04)
- [ ] **5.1.3.3** Валидация расчётного счёта (20 цифр, контрольная сумма)
- [ ] **5.1.3.4** Создать `BankDetailsValidator`:
  ```python
  class BankDetailsValidator:
      def validate_bik(bik: str) -> bool
      def validate_account(account: str, bik: str) -> bool
      def validate_corr_account(corr: str, bik: str) -> bool
  ```

#### 5.1.4 API Endpoints

- [ ] **5.1.4.1** `POST /payment-profiles` — создать профиль
- [ ] **5.1.4.2** `GET /payment-profiles/me` — получить свой профиль
- [ ] **5.1.4.3** `PUT /payment-profiles/me` — обновить профиль
- [ ] **5.1.4.4** `GET /payment-profiles/me/status` — статус onboarding
- [ ] **5.1.4.5** Pydantic schemas для request/response

### Критерии приёмки

- [ ] Модель создана и мигрирована
- [ ] Sensitive fields зашифрованы
- [ ] Валидация работает
- [ ] CRUD API готов

---

## TASK-5.2: Bank Onboarding Flow

**Приоритет:** P0
**Оценка:** 5 дней
**Тип:** Backend + Frontend

### Описание

Встраиваемый onboarding в T-Bank: минимум касаний, максимум автоматизации.

### Подзадачи

#### 5.2.1 T-Bank Onboarding API

- [ ] **5.2.1.1** Изучить T-Bank Merchant Onboarding API
- [ ] **5.2.1.2** Создать `TBankOnboardingClient`:
  ```python
  class TBankOnboardingClient:
      async def initiate_onboarding(
          self,
          profile: PaymentProfile
      ) -> InitiateResponse:
          """Начать процесс регистрации мерчанта"""
          pass

      async def submit_documents(
          self,
          merchant_id: str,
          documents: List[Document]
      ) -> SubmitResponse:
          """Загрузить документы для KYC"""
          pass

      async def check_status(
          self,
          merchant_id: str
      ) -> StatusResponse:
          """Проверить статус onboarding"""
          pass

      async def get_agreement_url(
          self,
          merchant_id: str
      ) -> str:
          """Получить URL для подписания договора с банком"""
          pass
  ```
- [ ] **5.2.1.3** Error handling + retry

#### 5.2.2 Onboarding Service

- [ ] **5.2.2.1** Создать `OnboardingService`:
  ```python
  class OnboardingService:
      async def start_onboarding(self, profile: PaymentProfile):
          # Проверить что профиль заполнен
          validate_profile_completeness(profile)

          # Инициировать в банке
          response = await tbank_onboarding.initiate_onboarding(profile)

          profile.bank_merchant_id = response.merchant_id
          profile.bank_onboarding_status = OnboardingStatus.DOCUMENTS_REQUIRED

          return OnboardingStarted(
              merchant_id=response.merchant_id,
              required_documents=response.required_documents,
              agreement_url=response.agreement_url
          )

      async def submit_kyc_documents(
          self,
          profile: PaymentProfile,
          documents: List[UploadedDocument]
      ):
          await tbank_onboarding.submit_documents(
              profile.bank_merchant_id,
              documents
          )
          profile.kyc_status = KYCStatus.DOCUMENTS_UPLOADED
          profile.kyc_submitted_at = datetime.utcnow()

      async def sync_status(self, profile: PaymentProfile):
          response = await tbank_onboarding.check_status(profile.bank_merchant_id)
          profile.bank_onboarding_status = map_status(response.status)
          profile.kyc_status = map_kyc_status(response.kyc_status)

          if response.status == "approved":
              profile.bank_onboarded_at = datetime.utcnow()
  ```
- [ ] **5.2.2.2** Celery task для периодической синхронизации статусов

#### 5.2.3 Webhook Handler

- [ ] **5.2.3.1** Endpoint для webhooks от T-Bank Onboarding:
  ```python
  @router.post("/webhooks/tbank-onboarding")
  async def handle_onboarding_webhook(payload: dict):
      merchant_id = payload.get("merchant_id")
      event_type = payload.get("event_type")

      profile = await get_profile_by_merchant_id(merchant_id)

      if event_type == "kyc_approved":
          profile.kyc_status = KYCStatus.APPROVED
          profile.kyc_approved_at = datetime.utcnow()
          await notify_user_kyc_approved(profile)

      elif event_type == "kyc_rejected":
          profile.kyc_status = KYCStatus.REJECTED
          profile.kyc_rejection_reason = payload.get("reason")
          await notify_user_kyc_rejected(profile)

      elif event_type == "onboarding_complete":
          profile.bank_onboarding_status = OnboardingStatus.APPROVED
          profile.bank_onboarded_at = datetime.utcnow()
  ```
- [ ] **5.2.3.2** Signature validation

#### 5.2.4 Frontend Wizard

- [ ] **5.2.4.1** Создать страницу `/agent/onboarding`:
  - Step 1: Тип (СМЗ/ИП/ООО)
  - Step 2: Реквизиты (ИНН → автозаполнение)
  - Step 3: Банковские данные
  - Step 4: Загрузка документов (если нужны)
  - Step 5: Подписание договора с банком (iframe/redirect)
  - Step 6: Ожидание KYC
  - Step 7: Выбор фискализации
  - Step 8: Ready!
- [ ] **5.2.4.2** Progress indicator
- [ ] **5.2.4.3** Сохранение прогресса (можно продолжить позже)
- [ ] **5.2.4.4** Статусы: "На проверке", "Требуются документы", "Готов"

#### 5.2.5 Blocking Logic

- [ ] **5.2.5.1** Нельзя создать сделку без завершённого onboarding:
  ```python
  async def create_deal(deal_data, user):
      profile = await get_payment_profile(user)
      if not profile or profile.bank_onboarding_status != OnboardingStatus.APPROVED:
          raise HTTPException(400, "Complete onboarding first")
  ```
- [ ] **5.2.5.2** UI: показать banner "Завершите настройку профиля"
- [ ] **5.2.5.3** Redirect на onboarding если профиль не готов

#### 5.2.6 Notifications

- [ ] **5.2.6.1** Email при KYC approved
- [ ] **5.2.6.2** Email при KYC rejected с причиной
- [ ] **5.2.6.3** SMS при готовности принимать платежи
- [ ] **5.2.6.4** Reminder если onboarding не завершён за 7 дней

### Критерии приёмки

- [ ] Агент может пройти onboarding без звонков
- [ ] Статус KYC отображается в UI
- [ ] Webhook обновляет статус
- [ ] Нельзя создать сделку без onboarding
- [ ] Уведомления работают

---

## TASK-5.3: INN Auto-Fill Service

**Приоритет:** P2
**Оценка:** 2 дня
**Тип:** Backend

### Описание

Автозаполнение реквизитов по ИНН через DaData API.

### Подзадачи

#### 5.3.1 DaData Integration

- [ ] **5.3.1.1** Добавить в config:
  ```python
  DADATA_API_KEY: str
  DADATA_SECRET_KEY: str
  ```
- [ ] **5.3.1.2** Создать `DaDataClient`:
  ```python
  class DaDataClient:
      async def find_by_inn(self, inn: str) -> CompanyInfo:
          """
          Returns:
              - name: str
              - full_name: str
              - ogrn: str
              - kpp: str (для ООО)
              - address: str
              - management: dict (директор)
              - type: str (LEGAL/INDIVIDUAL)
          """
          pass

      async def suggest_bank(self, query: str) -> List[BankInfo]:
          """Поиск банка по названию/БИК"""
          pass
  ```
- [ ] **5.3.1.3** Cache results (24 часа)

#### 5.3.2 Auto-Fill Endpoint

- [ ] **5.3.2.1** `GET /lookup/inn/{inn}`:
  ```python
  @router.get("/lookup/inn/{inn}")
  async def lookup_by_inn(inn: str):
      # Validate INN
      if not inn_validator.validate_checksum(inn):
          raise HTTPException(400, "Invalid INN")

      # Lookup
      info = await dadata.find_by_inn(inn)

      return {
          "inn": inn,
          "name": info.name,
          "full_name": info.full_name,
          "ogrn": info.ogrn,
          "kpp": info.kpp,
          "address": info.address,
          "legal_type": "IP" if len(inn) == 12 else "OOO"
      }
  ```
- [ ] **5.3.2.2** `GET /lookup/bank/{bik}`:
  ```python
  @router.get("/lookup/bank/{bik}")
  async def lookup_bank(bik: str):
      info = await dadata.find_bank_by_bik(bik)
      return {
          "bik": bik,
          "name": info.name,
          "corr_account": info.correspondent_account,
          "address": info.address
      }
  ```

#### 5.3.3 Frontend Integration

- [ ] **5.3.3.1** При вводе ИНН → debounced lookup → auto-fill форму
- [ ] **5.3.3.2** При вводе БИК → lookup → auto-fill название банка и корр. счёт
- [ ] **5.3.3.3** Показать "Данные заполнены автоматически" indicator

### Критерии приёмки

- [ ] ИНН → автозаполнение name, ogrn, kpp, address
- [ ] БИК → автозаполнение bank name, corr account
- [ ] Кеширование работает

---

# EPIC-6: Documentation Rewrite

**Цель:** Убрать все упоминания "MoR", "эскроу", "платформа принимает" из документации и UI.

---

## TASK-6.1: PRODUCT_OVERVIEW.md Rewrite

**Приоритет:** P0
**Оценка:** 1 день
**Тип:** Documentation

### Подзадачи

- [ ] **6.1.1** Заменить заголовок:
  ```
  Было: "платформа безопасных сделок... через банковский эскроу"
  Стало: "ИТ-платформа управления сделками с безопасными расчётами через банк"
  ```

- [ ] **6.1.2** Обновить раздел "Решение":
  ```
  Было: "Деньги на эскроу до выполнения"
  Стало: "Средства удерживаются банком до подтверждения услуги"
  ```

- [ ] **6.1.3** Обновить раздел "Финансовый поток":
  ```
  Было: "принимает платёж на номинальный счёт"
  Стало: "банк принимает платёж и удерживает до подтверждения"
  ```

- [ ] **6.1.4** Убрать все упоминания "MoR":
  ```
  Было: "MoR + Instant Split"
  Стало: "Bank-Led Safe Deal"
  ```

- [ ] **6.1.5** Обновить раздел "Hold period":
  ```
  Было: "1 час холд"
  Стало: "Период подтверждения (настраиваемый, default 72 часа)"
  ```

- [ ] **6.1.6** Добавить раздел "Юридическая структура":
  ```
  - Слой 1: Договор Исполнитель-Клиент (B2C)
  - Слой 2: Оферта Housler-Исполнитель (B2B ИТ-услуги)
  - Housler НЕ принимает деньги клиента
  ```

- [ ] **6.1.7** Обновить раздел "Интеграции / T-Bank":
  ```
  Housler управляет lifecycle: create → hold → confirm/release/cancel
  Деньги в контуре банка, Housler получает только B2B fee
  ```

### Критерии приёмки

- [ ] Grep по "эскроу", "MoR", "номинальный" — 0 результатов
- [ ] Документ отражает bank-led модель

---

## TASK-6.2: UI Copy Update

**Приоритет:** P1
**Оценка:** 2 дня
**Тип:** Frontend

### Подзадачи

#### 6.2.1 Audit & Replace

- [ ] **6.2.1.1** Grep по frontend/ для:
  - "эскроу" → "безопасная сделка"
  - "автовыплата через 1 час" → "выплата после подтверждения"
  - "номинальный счёт" → убрать
  - "платформа принимает" → "банк принимает"

#### 6.2.2 Specific Pages

- [ ] **6.2.2.1** `/agent/deals/bank-split/new` — форма создания:
  - Обновить описание процесса
  - Убрать упоминания "1 час"
  - Добавить "Выплата после подтверждения услуги"

- [ ] **6.2.2.2** `/pay/[dealId]` — страница оплаты:
  - Обновить текст: "Оплата через T-Bank. Средства удерживаются до подтверждения."

- [ ] **6.2.2.3** `/agent/deals/[id]` — детали сделки:
  - Обновить статусы и описания
  - Убрать "автоматическая выплата через 1 час"

- [ ] **6.2.2.4** Dashboard tooltips и help texts

#### 6.2.3 Consent Texts

- [ ] **6.2.3.1** Обновить все consent checkboxes (см. TASK-4.2)

#### 6.2.4 Error Messages

- [ ] **6.2.4.1** Проверить error messages на наличие старых терминов
- [ ] **6.2.4.2** Обновить если нужно

### Критерии приёмки

- [ ] UI не содержит "эскроу", "MoR", "1 час автовыплата"
- [ ] Тексты соответствуют bank-led модели

---

## TASK-6.3: API Documentation Update

**Приоритет:** P1
**Оценка:** 1 день
**Тип:** Documentation

### Подзадачи

- [ ] **6.3.1** Обновить `docs/features/bank-split/API_CONTRACTS.md`:
  - Новые endpoints (release, webhooks)
  - Обновлённые статусы
  - Idempotency key requirements

- [ ] **6.3.2** Обновить `docs/features/bank-split/ARCHITECTURE.md`:
  - Добавить диаграмму bank-led flow
  - Описать webhook handling
  - Описать reconciliation

- [ ] **6.3.3** Создать `docs/features/bank-split/BANK_INTEGRATION.md`:
  - T-Bank API overview
  - Webhook events
  - Error handling
  - Idempotency

- [ ] **6.3.4** Обновить OpenAPI spec (если есть):
  - Добавить новые endpoints
  - Обновить descriptions

### Критерии приёмки

- [ ] API docs актуальны
- [ ] Архитектурные диаграммы обновлены

---

## TASK-6.4: Contract Templates Update

**Приоритет:** P0 (юридический)
**Оценка:** 1 день
**Тип:** Backend

### Подзадачи

- [ ] **6.4.1** Обновить все 6 шаблонов (см. TASK-4.1)
- [ ] **6.4.2** Обновить seed script: `backend/scripts/seed_contract_templates.py`
- [ ] **6.4.3** Создать migration для обновления версий шаблонов
- [ ] **6.4.4** Убедиться что старые договоры остаются валидными (versioning)

### Критерии приёмки

- [ ] Шаблоны обновлены в БД
- [ ] Старые договоры не затронуты
- [ ] Новые сделки используют новые шаблоны

---

# Приоритизация и Phases

## Phase 6: Critical Compliance

**Срок:** 3 недели
**Цель:** Устранить регуляторные блокеры

| Week | Tasks |
|------|-------|
| Week 1 | TASK-1.1 (API refactor), TASK-2.1 (Hold period), TASK-5.1 (Payment Profile) |
| Week 2 | TASK-1.2 (Webhooks), TASK-2.2 (Release by event), TASK-2.3 (Dispute lock) |
| Week 3 | TASK-3.1 (Fiscal infra), TASK-3.2 (T-Bank Checks), TASK-4.1 (Contracts) |

## Phase 7: Operational Excellence

**Срок:** 2 недели
**Цель:** Onboarding + Documentation

| Week | Tasks |
|------|-------|
| Week 4 | TASK-5.2 (Bank Onboarding), TASK-4.2 (Consent flow) |
| Week 5 | TASK-1.3 (Remove MoR), TASK-6.1-6.4 (Documentation) |

## Phase 8: Nice to Have

**Срок:** По возможности
**Цель:** Дополнительные улучшения

| Tasks |
|-------|
| TASK-2.4 (Milestones) |
| TASK-3.3 (NPD tracking) |
| TASK-5.3 (INN auto-fill) |

---

# Метрики успеха

| Метрика | Phase 6 Target | Phase 7 Target |
|---------|----------------|----------------|
| Упоминаний "MoR/эскроу" в коде | < 10 | 0 |
| Webhook signature validation | 100% | 100% |
| Idempotent operations | 80% | 100% |
| ИП/ООО с фискализацией | 50% | 100% |
| Onboarding completion rate | — | > 80% |
| Avg time to release | — | < 3 days |

---

# Открытые вопросы

1. **T-Bank API:** Есть ли partial release для milestones?
2. **T-Bank Onboarding:** White-label KYC доступен?
3. **Юрист:** Когда ревью обновлённых шаблонов?
4. **Hold period default:** 72 часа или 7 дней?
5. **Фискализация:** Кто платит 1.5% — исполнитель или Housler?
6. **DaData:** Есть ли API key?

---

*Документ создан: 2026-01-19*
*Версия: 2.0 (Detailed)*
*Всего задач: 19*
*Всего подзадач: 135*
