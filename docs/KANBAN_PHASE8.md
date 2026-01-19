# KANBAN: Phase 8 — Nice to Have

**Дата начала:** 2026-01-19
**Дата завершения:** 2026-01-19
**Цель:** Дополнительные улучшения
**Статус:** COMPLETED

---

## DONE

| ID | Задача | Исполнитель | Завершено |
|----|--------|-------------|-----------|
| TASK-2.4 | Two-Stage Payment (Milestones) | Agent a062693 | 2026-01-19 |
| TASK-3.3 | NPD Receipt Tracking | Agent adf08ac | 2026-01-19 |
| TASK-5.3 | INN Auto-Fill (DaData) | Agent a651d2b | 2026-01-19 |

---

## МИГРАЦИИ

| Revision | Описание | Статус |
|----------|----------|--------|
| 027_add_milestone_release_fields | TASK-2.4: Milestone release triggers | Ready |
| 027_add_npd_receipt_fields | TASK-3.3: NPD receipt tracking | Ready |
| 028_merge_027_heads | Merge Phase 8 | Ready |

---

## СОЗДАННЫЕ АРТЕФАКТЫ

### TASK-2.4: Two-Stage Payment (Milestones)
- `ReleaseTrigger` enum: IMMEDIATE, SHORT_HOLD, CONFIRMATION, DATE
- DealMilestone model: расширен полями release_trigger, release_delay_hours, release_date
- `MilestoneService` — создание этапов, автоматический release
- Endpoints:
  - `GET /deals/{id}/milestones`
  - `POST /deals/{id}/milestones`
  - `POST /deals/{id}/milestones/{id}/release`
  - `POST /deals/{id}/milestones/{id}/confirm`
- Background task: `check_milestone_triggers()`
- Preset configs: `standard_30_70`, `standard_50_50`, `single_confirmation`

### TASK-3.3: NPD Receipt Tracking
- `NPDReceiptSource` enum: my_nalog_app, my_nalog_api, manual
- FiscalReceipt model: расширен полями для NPD tracking
- `NPDReceiptService` — создание pending receipts, напоминания
- Endpoints:
  - `GET /receipts/pending`
  - `POST /receipts/{id}/upload`
  - `GET /admin/receipts/overdue`
- Reminder schedule: 24h, 72h, 7d escalation
- Notification integration: SMS + Email

### TASK-5.3: INN Auto-Fill (DaData)
- `DaDataClient` — API client с mock режимом
- `INNService` — lookup, validation, autofill
- `CompanyInfo`, `BankInfo` data classes
- INN checksum validation (local)
- Endpoints:
  - `GET /inn/lookup`
  - `GET /inn/autofill`
  - `POST /inn/validate`
  - `GET /inn/bik/lookup`
- Tests: 23 passing

---

*Обновлено: 2026-01-19*
*Phase 8 COMPLETED*
