# Backlog: Bank-Led Safe Deal Architecture

**Дата создания:** 2026-01-19
**Версия:** 1.0
**Статус:** Draft

---

## Контекст

Текущая реализация содержит три корневых блокера, которые создают регуляторные и операционные риски:

| Блокер | Проблема | Риск |
|--------|----------|------|
| A | Формулировки "MoR/эскроу/номинальный счёт" | Платёжный агент / агрегатор |
| B | Автовыплата через 1 час | Chargeback, споры без evidence |
| C | Нет фискализации для ИП/ООО | Нарушение 54-ФЗ |

**Целевое состояние:** strict bank-led схема, где Housler НЕ принимает деньги, а только управляет жизненным циклом сделки.

---

## Эпики

```
EPIC-1: Bank-Led Architecture      ← Блокер A (регуляторный)
EPIC-2: Release by Event           ← Блокер B (операционный)
EPIC-3: Fiscalization              ← Блокер C (54-ФЗ)
EPIC-4: Legal Layer Restructure    ← Договорная структура
EPIC-5: Merchant Onboarding        ← KYC + Payment Profile
EPIC-6: Documentation Rewrite      ← Тексты и UI
```

---

## EPIC-1: Bank-Led Architecture

**Цель:** Housler НЕ принимает деньги. Деньги всегда в контуре банка.

### TASK-1.1: Рефакторинг API create/confirm/cancel

**Приоритет:** P0 (блокер)
**Тип:** Backend

**Текущее состояние:**
- API создаёт сделку локально, затем в банке
- Нет чёткого разделения "платёж в банке" vs "сделка в Housler"

**Целевое состояние:**
```
Housler → банк: createTransaction(сумма, получатели, доли, fee Housler)
Банк → Housler: external_deal_id + payment_url
```

**Задачи:**
- [ ] Переименовать internal status flow: `DRAFT → BANK_CREATED → PAYMENT_PENDING → HOLD → WAIT_CONFIRMATION → RELEASED/CANCELLED`
- [ ] Добавить `external_deal_id` mapping в модель Deal
- [ ] Реализовать idempotency keys для всех банковских операций
- [ ] Добавить retry logic с exponential backoff
- [ ] Полный audit trail для каждой операции

**Критерии приёмки:**
- Все денежные операции проходят через банк API
- Housler хранит только `external_deal_id` и статусы
- Каждая операция имеет idempotency key

---

### TASK-1.2: Webhook Handler Hardening

**Приоритет:** P0
**Тип:** Backend

**Текущее состояние:**
- Базовый webhook handler для T-Bank
- Нет валидации подписи
- Нет идемпотентности

**Целевое состояние:**
- Signature validation для каждого webhook
- Idempotent processing (повторный webhook = no-op)
- Dead letter queue для failed webhooks

**Задачи:**
- [ ] Реализовать signature validation (HMAC-SHA256)
- [ ] Добавить `processed_at` в BankEvent для идемпотентности
- [ ] Реализовать DLQ для failed webhooks
- [ ] Добавить мониторинг и алерты на failed webhooks
- [ ] Reconciliation job: сверка статусов с банком каждые N минут

**Критерии приёмки:**
- Webhook без валидной подписи → 401
- Повторный webhook → 200 OK, no-op
- Failed webhook → DLQ + alert

---

### TASK-1.3: Remove MoR References

**Приоритет:** P1
**Тип:** Backend + Frontend

**Задачи:**
- [ ] Удалить enum/константу `PaymentModel.MOR` если есть
- [ ] Заменить все упоминания "MoR" в коде на "bank_split"
- [ ] Проверить и обновить API responses
- [ ] Обновить frontend labels

**Файлы для проверки:**
- `backend/app/models/deal.py`
- `backend/app/schemas/deal.py`
- `frontend/lib/api/deals.ts`

---

## EPIC-2: Release by Event

**Цель:** Убрать автоматический релиз через 1 час. Релиз только по подтверждению события.

### TASK-2.1: Configurable Hold Period

**Приоритет:** P0 (блокер)
**Тип:** Backend

**Текущее состояние:**
- Фиксированный hold = 1 час
- Автоматический release по таймеру

**Целевое состояние:**
- Конфигурируемый hold period (default: 72 часа)
- Release только по команде (manual или event-triggered)
- Auto-release через N дней при отсутствии претензии (configurable, default: 7 дней)

**Задачи:**
- [ ] Добавить `hold_duration_hours` в Deal model (default: 72)
- [ ] Добавить `auto_release_days` в Deal model (default: 7)
- [ ] Изменить Celery task `process_hold_expiry`:
  - Не release автоматически через 1 час
  - Release только если `auto_release_days` прошло И нет открытых споров
- [ ] Добавить API endpoint для manual release
- [ ] Добавить config в settings: `DEFAULT_HOLD_HOURS`, `DEFAULT_AUTO_RELEASE_DAYS`

**Критерии приёмки:**
- Hold period настраивается при создании сделки
- Автоматический release только после `auto_release_days` без претензий
- Manual release доступен авторизованным пользователям

---

### TASK-2.2: Release by Confirmation Event

**Приоритет:** P0
**Тип:** Backend

**Текущее состояние:**
- `ServiceCompletion` модель существует
- Подтверждение не триггерит release

**Целевое состояние:**
- Подтверждение услуги → автоматический release (если нет споров)
- Evidence pack опционален, но рекомендуется
- RBAC: кто может подтверждать (agent/agency/tl)

**Задачи:**
- [ ] Добавить `triggers_release` flag в ServiceCompletion
- [ ] Реализовать auto-release при подтверждении:
  ```python
  if completion.triggers_release and not deal.has_open_disputes:
      bank_service.confirm_release(deal.external_deal_id)
  ```
- [ ] Добавить RBAC проверку: кто может подтверждать
- [ ] Добавить уведомления участникам о release

**Критерии приёмки:**
- Подтверждение услуги = release (если нет споров)
- Нельзя подтвердить при открытом споре
- Уведомления всем участникам

---

### TASK-2.3: Dispute Lock Mechanism

**Приоритет:** P0
**Тип:** Backend

**Текущее состояние:**
- Споры создаются, но не блокируют release

**Целевое состояние:**
- Открытый спор = DISPUTE_LOCK на release
- Release невозможен до resolution
- Таймеры на разрешение споров

**Задачи:**
- [ ] Добавить `dispute_locked` flag в Deal
- [ ] При создании спора: `deal.dispute_locked = True`
- [ ] Блокировать release при `dispute_locked = True`
- [ ] При resolution спора:
  - RESOLVED → снять lock, release
  - REJECTED → снять lock, release
  - REFUND → cancel/refund через банк
- [ ] Добавить таймеры:
  - 24 часа на первичное решение агентства
  - 72 часа на эскалацию на платформу
  - 7 дней максимум на весь процесс

**Критерии приёмки:**
- Спор блокирует release
- Resolution снимает блок
- Таймеры работают

---

### TASK-2.4: Two-Stage Payment (Milestone)

**Приоритет:** P2
**Тип:** Backend + Frontend

**Описание:** Разделение платежа на этапы (аванс + остаток)

**Текущее состояние:**
- Поддержка аванса есть в модели
- Нет milestone-based release

**Целевое состояние:**
- Milestone A (аванс): release сразу или через короткое окно
- Milestone B (остаток): release по событию

**Задачи:**
- [ ] Расширить DealMilestone model:
  - `release_trigger`: IMMEDIATE / CONFIRMATION / DATE
  - `release_delay_hours`: для короткого окна
- [ ] Реализовать partial release в банк API
- [ ] UI для настройки milestones при создании сделки
- [ ] Отображение статуса каждого milestone

---

## EPIC-3: Fiscalization (54-ФЗ)

**Цель:** ИП/ООО выдают кассовый чек при приёме оплаты от физлица.

### TASK-3.1: Fiscalization Strategy Selection

**Приоритет:** P0 (блокер для ИП/ООО)
**Тип:** Backend + Frontend

**Контекст:**
- Самозанятый (НПД) = чек НПД, не 54-ФЗ → уже работает
- ИП/ООО = кассовый чек 54-ФЗ → НЕ реализовано

**Опции:**
| Опция | Стоимость | Когда выгодно |
|-------|-----------|---------------|
| Чеки Т-Бизнеса | 1.5% с платежа | Редкие/мелкие платежи |
| CloudKassir | ~2000 руб/мес | Частые/крупные платежи |

**Задачи:**
- [ ] Добавить `fiscalization_method` в PaymentProfile:
  - `NPD_RECEIPT` — самозанятый
  - `TBANK_CHECKS` — Чеки Т-Бизнеса
  - `CLOUD_KASSIR` — Облачная касса
  - `EXTERNAL` — своя касса (вне Housler)
- [ ] UI для выбора метода при onboarding
- [ ] Калькулятор "что выгоднее" на основе среднего чека

---

### TASK-3.2: T-Bank Checks Integration

**Приоритет:** P1
**Тип:** Backend

**Описание:** Интеграция с "Чеки Т-Бизнеса" для ИП/ООО

**Задачи:**
- [ ] Изучить API "Чеки Т-Бизнеса"
- [ ] Реализовать `TBankChecksService`:
  - `create_receipt(deal, recipient)` — создать чек
  - `get_receipt_status(receipt_id)` — статус
  - `get_receipt_url(receipt_id)` — ссылка на чек
- [ ] Автоматическая фискализация при release:
  ```python
  if recipient.legal_type in [IP, OOO] and recipient.fiscalization_method == TBANK_CHECKS:
      checks_service.create_receipt(deal, recipient)
  ```
- [ ] Хранение receipt_id и статуса в БД
- [ ] Webhook handler для статусов чеков

**Критерии приёмки:**
- Чек создаётся автоматически при release для ИП/ООО
- Ссылка на чек доступна в UI
- Ошибки фискализации логируются и алертятся

---

### TASK-3.3: CloudKassir Integration (Optional)

**Приоритет:** P2
**Тип:** Backend

**Описание:** Альтернатива для тех, кому выгоднее облачная касса

**Задачи:**
- [ ] Изучить CloudKassir API
- [ ] Реализовать `CloudKassirService` аналогично TBankChecksService
- [ ] UI для настройки CloudKassir credentials в PaymentProfile
- [ ] Feature flag для включения/отключения

---

### TASK-3.4: NPD Receipt Tracking

**Приоритет:** P1
**Тип:** Backend

**Описание:** Отслеживание чеков НПД для самозанятых

**Текущее состояние:**
- Валидация NPD статуса есть
- Нет tracking чеков

**Задачи:**
- [ ] Добавить `npd_receipt_url` в DealSplitRecipient
- [ ] Напоминание самозанятому сформировать чек после release
- [ ] UI для загрузки/ввода ссылки на чек НПД
- [ ] Опционально: интеграция с API "Мой налог" для автоматического tracking

---

## EPIC-4: Legal Layer Restructure

**Цель:** Два договорных слоя: B2C (Исполнитель-Клиент) и B2B (Housler-Исполнитель)

### TASK-4.1: Contract Layer Separation

**Приоритет:** P0 (юридический)
**Тип:** Documentation + Templates

**Слой 1 (B2C/B2B услуга):**
- Договор между Исполнителем (агент/ИП/ООО) и Клиентом
- Оплата: "на платежной странице банка; средства удерживаются банком до подтверждения"
- Housler НЕ упоминается как получатель денег

**Слой 2 (B2B ИТ-услуги):**
- Договор/оферта между Housler и Исполнителем
- Вознаграждение Housler = B2B плата за ИТ-услуги
- Исполнитель даёт поручение банку удерживать fee Housler из поступлений

**Задачи:**
- [ ] Обновить шаблон TPL-001..003: убрать упоминания "платформа принимает"
- [ ] Создать шаблон оферты B2B Housler-Исполнитель
- [ ] Добавить в оферту: "Исполнитель поручает банку удержать вознаграждение Площадки"
- [ ] Согласовать тексты с юристом

---

### TASK-4.2: Consent Flow Update

**Приоритет:** P1
**Тип:** Backend + Frontend

**Текущее состояние:**
- `PLATFORM_COMMISSION` consent — согласие на 4%

**Целевое состояние:**
- Consent привязан к B2B слою
- Формулировка: "Согласен на удержание вознаграждения Площадки из моих поступлений"

**Задачи:**
- [ ] Обновить текст consent в UI
- [ ] Добавить ссылку на оферту B2B в consent
- [ ] Убедиться, что consent записывается с IP, timestamp, user-agent

---

## EPIC-5: Merchant Onboarding

**Цель:** Единый onboarding flow: Housler Profile + Bank KYC + Fiscalization

### TASK-5.1: Payment Profile Model

**Приоритет:** P0
**Тип:** Backend

**Описание:** Расширенный профиль для приёма платежей

**Задачи:**
- [ ] Создать модель `PaymentProfile`:
  ```python
  class PaymentProfile(Base):
      id: UUID
      user_id / organization_id
      legal_type: LegalType  # SE, IP, OOO
      inn: str (encrypted)
      bank_account: str (encrypted)
      bik: str
      bank_name: str
      fiscalization_method: FiscalizationMethod
      bank_onboarding_status: OnboardingStatus
      bank_merchant_id: str  # external ID в банке
      kyc_status: KYCStatus
      created_at, updated_at
  ```
- [ ] Миграция
- [ ] API CRUD endpoints

---

### TASK-5.2: Bank Onboarding Flow

**Приоритет:** P0
**Тип:** Backend + Frontend

**Описание:** Встраиваемый onboarding в банк (KYC без "общения")

**Задачи:**
- [ ] Изучить T-Bank Merchant Onboarding API
- [ ] Реализовать `BankOnboardingService`:
  - `initiate_onboarding(payment_profile)` — начать процесс
  - `check_onboarding_status(merchant_id)` — статус KYC
  - `complete_onboarding(merchant_id)` — завершить
- [ ] UI wizard для onboarding:
  1. Ввод реквизитов (автозаполнение по ИНН)
  2. E-sign документов банка
  3. Ожидание KYC
  4. Выбор фискализации
  5. Ready
- [ ] Webhook handler для статусов onboarding

**Критерии приёмки:**
- Агент может пройти onboarding без звонков/визитов
- Статус KYC отображается в UI
- Нельзя создать сделку без завершённого onboarding

---

### TASK-5.3: INN Auto-Fill Service

**Приоритет:** P2
**Тип:** Backend

**Описание:** Автозаполнение реквизитов по ИНН через DaData/ФНС

**Задачи:**
- [ ] Интеграция с DaData API (или ФНС ЕГРЮЛ/ЕГРИП)
- [ ] При вводе ИНН → автозаполнение: название, адрес, ОГРН/ОГРНИП
- [ ] Кеширование результатов (24 часа)

---

## EPIC-6: Documentation Rewrite

**Цель:** Убрать все упоминания "MoR", "эскроу", "платформа принимает деньги"

### TASK-6.1: PRODUCT_OVERVIEW.md Rewrite

**Приоритет:** P0
**Тип:** Documentation

**Задачи:**
- [ ] Удалить: "MoR", "номинальный получатель", "деньги на балансе Housler", "эскроу"
- [ ] Вставить: "Оплата на стороне банка. Средства удерживаются банком до подтверждения оказания услуги."
- [ ] Обновить схему финансового потока
- [ ] Обновить раздел "Ключевые сценарии"

**Конкретные правки:**

| Было | Стало |
|------|-------|
| "платформа безопасных сделок... через банковский эскроу" | "ИТ-платформа управления сделками с безопасными расчётами через банк" |
| "принимает платёж на номинальный счёт" | "банк принимает платёж и удерживает до подтверждения" |
| "MoR + Instant Split" | "Bank-Led Safe Deal" |
| "Деньги на эскроу до выполнения" | "Средства удерживаются банком до подтверждения услуги" |
| "1 час холд" | "Период подтверждения (настраиваемый)" |

---

### TASK-6.2: UI Copy Update

**Приоритет:** P1
**Тип:** Frontend

**Задачи:**
- [ ] Аудит всех текстов в UI
- [ ] Заменить "эскроу" → "безопасная сделка"
- [ ] Заменить "автовыплата через 1 час" → "выплата после подтверждения"
- [ ] Обновить tooltips и help texts

**Файлы:**
- `frontend/app/agent/deals/bank-split/new/page.tsx`
- `frontend/app/pay/[dealId]/page.tsx`
- `frontend/components/deals/*`

---

### TASK-6.3: API Documentation Update

**Приоритет:** P1
**Тип:** Documentation

**Задачи:**
- [ ] Обновить `docs/features/bank-split/API_CONTRACTS.md`
- [ ] Обновить `docs/features/bank-split/ARCHITECTURE.md`
- [ ] Добавить диаграммы нового flow

---

### TASK-6.4: Contract Templates Update

**Приоритет:** P0 (юридический)
**Тип:** Backend + Legal

**Задачи:**
- [ ] Обновить TPL-001..006: убрать "платформа принимает/переводит"
- [ ] Добавить формулировку: "Оплата осуществляется через платёжную систему банка"
- [ ] Согласовать с юристом

---

## Приоритизация

### Phase 6: Critical Compliance (P0)

**Срок:** 2 недели

| Task | Epic | Описание |
|------|------|----------|
| TASK-1.1 | Bank-Led | API refactor create/confirm/cancel |
| TASK-1.2 | Bank-Led | Webhook hardening |
| TASK-2.1 | Release | Configurable hold period |
| TASK-2.2 | Release | Release by confirmation |
| TASK-2.3 | Release | Dispute lock |
| TASK-3.1 | Fiscal | Fiscalization strategy |
| TASK-4.1 | Legal | Contract layer separation |
| TASK-5.1 | Onboard | Payment Profile model |
| TASK-6.1 | Docs | PRODUCT_OVERVIEW rewrite |
| TASK-6.4 | Docs | Contract templates update |

### Phase 7: Operational Excellence (P1)

**Срок:** 2 недели после Phase 6

| Task | Epic | Описание |
|------|------|----------|
| TASK-1.3 | Bank-Led | Remove MoR references |
| TASK-3.2 | Fiscal | T-Bank Checks integration |
| TASK-3.4 | Fiscal | NPD receipt tracking |
| TASK-4.2 | Legal | Consent flow update |
| TASK-5.2 | Onboard | Bank onboarding flow |
| TASK-6.2 | Docs | UI copy update |
| TASK-6.3 | Docs | API documentation |

### Phase 8: Nice to Have (P2)

**Срок:** После Phase 7

| Task | Epic | Описание |
|------|------|----------|
| TASK-2.4 | Release | Two-stage payment (milestones) |
| TASK-3.3 | Fiscal | CloudKassir integration |
| TASK-5.3 | Onboard | INN auto-fill |

---

## Зависимости

```
TASK-5.1 (PaymentProfile) ←── TASK-5.2 (Bank Onboarding)
                         ←── TASK-3.1 (Fiscalization Strategy)
                         ←── TASK-3.2 (T-Bank Checks)

TASK-2.1 (Hold Period) ←── TASK-2.2 (Release by Event)
                       ←── TASK-2.3 (Dispute Lock)

TASK-4.1 (Contract Layers) ←── TASK-6.4 (Templates Update)
                           ←── TASK-4.2 (Consent Flow)

TASK-1.1 (API Refactor) ←── TASK-1.2 (Webhooks)
                        ←── TASK-1.3 (Remove MoR)
```

---

## Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| T-Bank API не поддерживает нужный flow | Средняя | Критическое | Ранний PoC, альтернативные банки |
| Юридическая ревизия затянется | Высокая | Среднее | Параллельная работа tech + legal |
| Fiscalization API изменится | Низкая | Среднее | Абстракция, feature flags |
| Пользователи привыкли к "1 час" | Средняя | Низкое | UX объяснение, настраиваемость |

---

## Метрики успеха Phase 6

| Метрика | Target |
|---------|--------|
| Упоминаний "MoR/эскроу" в коде | 0 |
| Webhook signature validation | 100% |
| Сделки с dispute lock | работает |
| ИП/ООО с фискализацией | 100% при release |
| Onboarding completion rate | > 80% |

---

## Открытые вопросы

1. **T-Bank API:** Поддерживает ли partial release для milestones?
2. **Юрист:** Когда можно получить ревью обновлённых шаблонов?
3. **Фискализация:** Кто платит за "Чеки" — исполнитель или Housler?
4. **Hold period default:** 72 часа или 7 дней?
5. **Bank onboarding:** Есть ли white-label KYC у T-Bank?

---

*Документ создан: 2026-01-19*
*Следующий шаг: Согласование с Product Owner*
