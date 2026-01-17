# Схема БД: Bank Hold + Split

## ERD диаграмма (Mermaid)

```mermaid
erDiagram
    %% ===== СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ (без изменений) =====

    users {
        int id PK
        string phone
        string email
        string full_name
        timestamp created_at
    }

    organizations {
        uuid id PK
        enum type
        string legal_name
        string inn UK
        string kpp
        jsonb bank_details
        enum status
        enum kyc_status
        int default_split_percent_agent
    }

    organization_members {
        uuid id PK
        uuid org_id FK
        int user_id FK
        enum role
        int default_split_percent_agent
        bool is_active
    }

    payout_accounts {
        uuid id PK
        string owner_type
        uuid owner_id
        enum method
        jsonb details
        timestamp verified_at
        bool is_default
    }

    %% ===== СДЕЛКИ (изменения) =====

    lk_deals {
        uuid id PK
        string type
        int created_by_user_id FK
        int agent_user_id FK
        string executor_type
        int executor_id
        string status
        numeric price
        numeric commission_agent
        string payment_model "NEW: MOR или BANK_HOLD_SPLIT"
        string external_provider "NEW: tbank"
        string external_deal_id "NEW"
        string external_account_number "NEW"
        string payment_link_url "NEW"
        text payment_qr_payload "NEW"
        timestamp expires_at "NEW"
        timestamp confirm_sla_at "NEW"
        string payer_email "NEW"
        text description "NEW"
    }

    %% ===== НОВЫЕ ТАБЛИЦЫ =====

    deal_split_recipients {
        uuid id PK
        uuid deal_id FK
        string role "agent/agency/lead/platform_fee"
        string legal_type "IP/OOO/SE"
        string inn
        string kpp
        int user_id FK
        uuid organization_id FK
        uuid payout_account_id FK
        string external_beneficiary_id
        string external_recipient_id
        string split_type "percent/fixed"
        numeric split_value
        numeric calculated_amount
        string payout_status
        timestamp paid_at
    }

    split_rule_templates {
        uuid id PK
        uuid organization_id FK
        string name
        string code
        text description
        jsonb applies_to_deal_types
        jsonb rules
        int version
        bool is_active
        int created_by_user_id FK
        int approved_by_user_id FK
        timestamp approved_at
    }

    bank_events {
        uuid id PK
        uuid deal_id FK
        uuid payment_intent_id FK
        string provider
        string external_event_id
        string event_type
        jsonb payload
        bool signature_valid
        timestamp processed_at
        text processing_error
        timestamp received_at
    }

    self_employed_registry {
        uuid id PK
        uuid organization_id FK
        int user_id FK
        string inn
        string full_name
        string external_recipient_id
        string bank_status "DRAFT/ACTIVE/BLOCKED"
        string npd_status
        timestamp npd_checked_at
        int receipt_cancel_count
        timestamp last_receipt_cancel_at
        bool risk_flag
    }

    evidence_files {
        uuid id PK
        uuid deal_id FK
        string kind
        string file_url
        string file_name
        int file_size
        string mime_type
        string file_hash
        int uploaded_by_user_id FK
        timestamp uploaded_at
        string upload_ip
        text upload_user_agent
        string status
        text notes
    }

    deal_milestones {
        uuid id PK
        uuid deal_id FK
        int step_no
        string name
        text description
        numeric amount
        string currency
        string trigger_type
        jsonb trigger_config
        string external_step_id
        string status
        string payment_link_url
        timestamp paid_at
        int confirmed_by_user_id FK
        timestamp confirmed_at
        timestamp released_at
    }

    %% ===== СУЩЕСТВУЮЩИЕ (для контекста) =====

    payment_schedules {
        uuid id PK
        uuid deal_id FK
        int step_no
        numeric amount
        string currency
        enum trigger_type
        jsonb trigger_meta
        enum status
    }

    payment_intents {
        uuid id PK
        uuid schedule_id FK
        string provider
        numeric amount
        string sbp_link
        timestamp expires_at
        enum status
        string provider_intent_id
        string idempotency_key
        string external_payment_id "NEW"
        string bank_status "NEW"
        timestamp bank_status_updated_at "NEW"
    }

    payments {
        uuid id PK
        uuid intent_id FK
        string provider_tx_id
        timestamp paid_at
        numeric gross_amount
        enum status
        jsonb provider_meta
    }

    documents {
        uuid id PK
        uuid deal_id FK
        uuid template_id FK
        int version_no
        enum status
        string file_url
        string document_hash
    }

    signatures {
        uuid id PK
        uuid document_id FK
        uuid signer_party_id FK
        enum method
        string phone
        timestamp signed_at
        jsonb evidence
    }

    audit_logs {
        uuid id PK
        string entity_type
        uuid entity_id
        string action
        int actor_user_id FK
        jsonb meta
        string ip_address
        text user_agent
    }

    %% ===== СВЯЗИ =====

    users ||--o{ organization_members : "has"
    organizations ||--o{ organization_members : "has"
    organizations ||--o{ split_rule_templates : "owns"
    organizations ||--o{ self_employed_registry : "manages"

    users ||--o{ lk_deals : "creates"
    users ||--o{ lk_deals : "agent_of"

    lk_deals ||--o{ deal_split_recipients : "has"
    lk_deals ||--o{ bank_events : "has"
    lk_deals ||--o{ evidence_files : "has"
    lk_deals ||--o{ deal_milestones : "has"
    lk_deals ||--o{ payment_schedules : "has"
    lk_deals ||--o{ documents : "has"

    deal_split_recipients ||--o| users : "recipient"
    deal_split_recipients ||--o| organizations : "recipient"
    deal_split_recipients ||--o| payout_accounts : "pays_to"

    self_employed_registry ||--|| users : "is"

    payment_schedules ||--o{ payment_intents : "has"
    payment_intents ||--o{ payments : "completes"
    payment_intents ||--o{ bank_events : "has"

    documents ||--o{ signatures : "has"

    users ||--o{ audit_logs : "performs"
    users ||--o{ evidence_files : "uploads"
    users ||--o{ deal_milestones : "confirms"
```

---

## Текстовая схема связей

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE ENTITIES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐         ┌───────────────┐         ┌──────────────────┐       │
│  │  users   │────────>│ org_members   │<────────│  organizations   │       │
│  └──────────┘         └───────────────┘         └──────────────────┘       │
│       │                                                  │                  │
│       │                                                  │                  │
│       v                                                  v                  │
│  ┌──────────┐                                   ┌──────────────────┐       │
│  │ lk_deals │<──────────────────────────────────│ split_rule_      │       │
│  │          │                                   │ templates        │       │
│  └──────────┘                                   └──────────────────┘       │
│       │                                                  │                  │
│       │                                                  │                  │
│       ├─────────────────────────┬────────────────────────┤                  │
│       │                         │                        │                  │
│       v                         v                        v                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐         │
│  │ deal_split_  │    │ deal_milestones  │    │ self_employed_   │         │
│  │ recipients   │    │ (этапы оплаты)   │    │ registry         │         │
│  └──────────────┘    └──────────────────┘    └──────────────────┘         │
│       │                       │                                            │
│       │                       v                                            │
│       │              ┌──────────────────┐                                  │
│       │              │ payment_schedules│                                  │
│       │              └──────────────────┘                                  │
│       │                       │                                            │
│       │                       v                                            │
│       │              ┌──────────────────┐                                  │
│       │              │ payment_intents  │                                  │
│       │              └──────────────────┘                                  │
│       │                       │                                            │
│       │                       ├────────────────────────┐                   │
│       │                       │                        │                   │
│       │                       v                        v                   │
│       │              ┌──────────────────┐    ┌──────────────────┐         │
│       └─────────────>│    payments      │    │   bank_events    │         │
│                      └──────────────────┘    │   (immutable)    │         │
│                                              └──────────────────┘         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                            DOCUMENTS & AUDIT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐         ┌───────────────┐         ┌──────────────────┐       │
│  │ lk_deals │────────>│   documents   │────────>│   signatures     │       │
│  └──────────┘         └───────────────┘         └──────────────────┘       │
│       │                                                                     │
│       │                                                                     │
│       ├─────────────────────────┬───────────────────────────────────────┐  │
│       │                         │                                        │  │
│       v                         v                                        v  │
│  ┌──────────────┐    ┌──────────────────┐                    ┌──────────┐  │
│  │ evidence_    │    │   audit_logs     │                    │ receipts │  │
│  │ files        │    │   (all actions)  │                    │          │  │
│  └──────────────┘    └──────────────────┘                    └──────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Индексы (критичные для производительности)

```sql
-- Поиск сделок
CREATE INDEX idx_lk_deals_status ON lk_deals(status);
CREATE INDEX idx_lk_deals_payment_model ON lk_deals(payment_model);
CREATE INDEX idx_lk_deals_external_deal_id ON lk_deals(external_deal_id);
CREATE INDEX idx_lk_deals_created_at ON lk_deals(created_at DESC);

-- Участники сплита
CREATE INDEX idx_split_recipients_deal ON deal_split_recipients(deal_id);
CREATE INDEX idx_split_recipients_payout_status ON deal_split_recipients(payout_status);

-- События банка
CREATE INDEX idx_bank_events_deal ON bank_events(deal_id);
CREATE INDEX idx_bank_events_type ON bank_events(event_type);
CREATE INDEX idx_bank_events_received ON bank_events(received_at DESC);

-- Самозанятые
CREATE INDEX idx_se_registry_status ON self_employed_registry(bank_status);
CREATE INDEX idx_se_registry_risk ON self_employed_registry(risk_flag) WHERE risk_flag = true;

-- Milestones
CREATE INDEX idx_milestones_deal_status ON deal_milestones(deal_id, status);
```

---

## Constraints (целостность данных)

```sql
-- Split recipients: сумма процентов = 100
-- (проверяется в коде, не в БД из-за сложности)

-- Milestones: step_no уникален в рамках сделки
ALTER TABLE deal_milestones
ADD CONSTRAINT uq_milestone_step UNIQUE (deal_id, step_no);

-- Self-employed: один пользователь - одна запись в org
ALTER TABLE self_employed_registry
ADD CONSTRAINT uq_se_org_user UNIQUE (organization_id, user_id);

-- Split rule templates: один активный код на org
CREATE UNIQUE INDEX idx_split_rules_active
ON split_rule_templates(organization_id, code)
WHERE is_active = true;
```

---

## Партиционирование (для scale)

```sql
-- bank_events растет быстро, партиционируем по месяцу
CREATE TABLE bank_events (
    ...
) PARTITION BY RANGE (received_at);

CREATE TABLE bank_events_2026_01 PARTITION OF bank_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE bank_events_2026_02 PARTITION OF bank_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- и т.д.

-- audit_logs аналогично
```

---

## Примеры данных

### Split Rule Template

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "organization_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Стандартный сплит 60/35/5",
  "code": "standard_60_35_5",
  "rules": {
    "recipients": [
      {"role": "agent", "type": "percent", "value": 60},
      {"role": "agency", "type": "percent", "value": 35},
      {"role": "platform_fee", "type": "percent", "value": 5}
    ],
    "min_platform_fee": 500,
    "rounding": "floor"
  },
  "version": 1,
  "is_active": true
}
```

### Deal Split Recipients (после оплаты 100,000 руб)

```json
[
  {
    "deal_id": "...",
    "role": "agent",
    "legal_type": "SE",
    "inn": "123456789012",
    "split_type": "percent",
    "split_value": 60,
    "calculated_amount": 60000.00,
    "payout_status": "released"
  },
  {
    "deal_id": "...",
    "role": "agency",
    "legal_type": "OOO",
    "inn": "1234567890",
    "split_type": "percent",
    "split_value": 35,
    "calculated_amount": 35000.00,
    "payout_status": "released"
  },
  {
    "deal_id": "...",
    "role": "platform_fee",
    "legal_type": "OOO",
    "inn": "9876543210",
    "split_type": "percent",
    "split_value": 5,
    "calculated_amount": 5000.00,
    "payout_status": "released"
  }
]
```

### Bank Event

```json
{
  "id": "...",
  "deal_id": "...",
  "provider": "tbank",
  "external_event_id": "evt_abc123",
  "event_type": "payment.completed",
  "payload": {
    "dealId": "tbank_deal_123",
    "amount": 100000,
    "currency": "RUB",
    "payerPhone": "+79001234567",
    "completedAt": "2026-01-16T14:30:00Z"
  },
  "signature_valid": true,
  "processed_at": "2026-01-16T14:30:01Z",
  "received_at": "2026-01-16T14:30:00Z"
}
```

---

*Документ создан: 2026-01-16*
