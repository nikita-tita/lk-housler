# Shared Database: LK + Agent

## Обзор

Проекты `lk.housler.ru` и `agent.housler.ru` используют **общую базу данных** `housler_agent` на контейнере `agent-postgres`. Это обеспечивает единую авторизацию и целостность данных пользователей, но создает дополнительные требования к координации при изменениях схемы.

```
lk.housler.ru           agent.housler.ru
┌───────────┐           ┌────────────────┐
│  Backend  │           │    Backend     │
│ (FastAPI) │           │   (Node.js)    │
└─────┬─────┘           └───────┬────────┘
      │                         │
      │  agent-network          │
      └─────────────┬───────────┘
                    │
                    ▼
            ┌──────────────┐
            │ agent-postgres│
            │  (housler_agent) │
            └──────────────┘
```

## Топология

### Docker сети

```
housler_agent_network (external)
    ├── agent-frontend    (Next.js)
    ├── agent-backend     (Node.js)
    ├── agent-postgres    <-- SHARED DATABASE
    ├── agent-redis
    ├── agent-nginx
    ├── lk-backend        <-- Подключен через external network
    └── lk-celery-worker  <-- Подключен через external network

lk-network (internal)
    ├── lk-backend
    ├── lk-frontend
    ├── lk-celery-worker
    ├── lk-celery-beat
    ├── lk-redis          (собственный Redis для cache/celery)
    ├── lk-minio          (S3 storage для документов)
    └── lk-nginx
```

### Connection String (Production)

```
DATABASE_URL=postgresql+asyncpg://housler:${DB_PASSWORD}@agent-postgres:5432/housler_agent
DATABASE_URL_SYNC=postgresql://housler:${DB_PASSWORD}@agent-postgres:5432/housler_agent
```

## Таблицы

### Owned by Agent (НЕ МЕНЯТЬ без координации)

Эти таблицы созданы и управляются проектом `agent.housler.ru`. Изменения требуют согласования с командой agent.

| Таблица | ID тип | Описание | Риск изменений |
|---------|--------|----------|----------------|
| `users` | **Integer** | Пользователи (авторизация) | CRITICAL |
| `auth_codes` | - | OTP коды | CRITICAL |
| `sessions` | - | Сессии пользователей | HIGH |

**User table schema (read-only для lk):**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,           -- INTEGER, не UUID!
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'client',
    is_active BOOLEAN DEFAULT TRUE,
    agency_id INTEGER,
    phone_verified BOOLEAN DEFAULT FALSE,
    city VARCHAR(100),
    is_self_employed BOOLEAN DEFAULT FALSE,
    personal_inn VARCHAR(12),
    password_hash VARCHAR(255),
    registration_status VARCHAR(20) DEFAULT 'active',
    -- Encrypted PII fields (152-FZ)
    email_hash VARCHAR(64),
    phone_hash VARCHAR(64),
    name_encrypted TEXT,
    phone_encrypted TEXT,
    email_encrypted TEXT,
    personal_inn_encrypted TEXT,
    personal_inn_hash VARCHAR(64),
    -- Contact preferences
    preferred_contact VARCHAR(20) DEFAULT 'phone',
    telegram_username VARCHAR(100),
    whatsapp_phone VARCHAR(20),
    -- Agent profile
    avatar_url VARCHAR(500),
    experience_years INTEGER,
    about TEXT,
    legal_data_filled BOOLEAN DEFAULT FALSE,
    -- Timestamps
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Owned by LK

Эти таблицы создаются и управляются проектом `lk.housler.ru` через Alembic миграции.

| Таблица | ID тип | Описание | FK к users |
|---------|--------|----------|------------|
| **Deals** |
| `lk_deals` | UUID | Сделки | created_by_user_id (INT), agent_user_id (INT) |
| `deal_parties` | UUID | Участники сделки | party_id (INT, nullable) |
| `deal_terms` | UUID | Условия сделки | - |
| `deal_milestones` | UUID | Этапы оплаты | confirmed_by_user_id (INT) |
| `deal_split_recipients` | UUID | Получатели сплита | user_id (INT) |
| **Documents** |
| `documents` | UUID | Документы | - |
| `contract_templates` | UUID | Шаблоны договоров | created_by_user_id (INT), approved_by_user_id (INT) |
| `signatures` | UUID | Подписи | - |
| `signing_tokens` | UUID | Токены подписания | - |
| `evidence_files` | UUID | Доказательные файлы | uploaded_by_user_id (INT) |
| **Payments** |
| `payment_schedules` | UUID | График платежей | - |
| `payment_intents` | UUID | Платежные намерения | - |
| `payments` | UUID | Платежи | - |
| **Ledger** |
| `ledger_entries` | UUID | Записи гроссбуха | - |
| `splits` | UUID | Сплиты платежей | - |
| `payouts` | UUID | Выплаты | - |
| **Organizations** |
| `organizations` | UUID | Организации | - |
| `organization_members` | UUID | Члены организации | user_id (INT) |
| `payout_accounts` | UUID | Счета для выплат | owner_id (UUID, polymorphic) |
| `split_rule_templates` | UUID | Шаблоны правил сплита | created_by_user_id (INT), approved_by_user_id (INT) |
| `self_employed_registry` | UUID | Реестр самозанятых | user_id (INT) |
| **Receipts** |
| `receipts` | UUID | Чеки | - |
| `npd_tasks` | UUID | Задачи НПД | user_id (INT) |
| **Antifraud** |
| `antifraud_checks` | UUID | Проверки антифрода | - |
| `user_limits` | UUID | Лимиты пользователей | user_id (INT) |
| `blacklist` | UUID | Черный список | - |
| **Bank Split (T-Bank)** |
| `bank_events` | UUID | Webhook события банка | - |
| **Audit** |
| `audit_logs` | UUID | Аудит лог | actor_user_id (INT) |

## Типы ID

| Модель | Тип ID | Причина |
|--------|--------|---------|
| User | **Integer** | Legacy от agent.housler.ru (Node.js Sequelize) |
| Deal | UUID | LK standard (Python SQLAlchemy) |
| Document | UUID | LK standard |
| Payment | UUID | LK standard |
| Organization | UUID | LK standard |
| DealParty | UUID | LK standard |
| *_Recipients | UUID | LK standard |
| *_Schedules | UUID | LK standard |

### Работа с разными типами ID

```python
# При создании сделки - user_id это INTEGER
deal = Deal(
    created_by_user_id=current_user.id,  # int
    agent_user_id=current_user.id,       # int
    type="secondary_buy",
)

# При FK на UUID таблицы LK
party = DealParty(
    deal_id=deal.id,        # UUID
    party_id=current_user.id,  # int (nullable)
    party_role=PartyRole.AGENT,
)
```

## Правила миграций

### При изменении LK-owned таблиц

1. Создать миграцию Alembic:
   ```bash
   cd backend
   alembic revision --autogenerate -m "description"
   ```

2. Проверить сгенерированную миграцию:
   - Убедиться что не затрагивает таблицу `users`
   - Проверить FK constraints на `users.id` (должен быть Integer)

3. Применить миграцию:
   ```bash
   alembic upgrade head
   ```

4. На production:
   ```bash
   ssh -i ~/.ssh/id_housler root@95.163.227.26
   cd /root/lk-housler
   docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
   ```

### При необходимости изменить Agent-owned таблицы

1. **Создать issue** в репозитории agent.housler.ru
2. **Согласовать изменение** с командой agent
3. **Синхронизировать миграции**:
   - Agent создает миграцию в своем проекте (Sequelize)
   - LK обновляет модель User в `backend/app/models/user.py`
4. **Деплой в правильном порядке**:
   - Сначала agent.housler.ru (с миграцией БД)
   - Затем lk.housler.ru (с обновленной моделью)

### Запрещенные операции

- DROP/ALTER на таблице `users` из LK
- Изменение типа `users.id`
- Добавление constraints на `users` из LK миграций
- Изменение `auth_codes`, `sessions` и других agent-таблиц

## Критические правила

1. **НИКОГДА не менять schema `users` без координации с agent**
   - Таблица users - источник правды для авторизации
   - Изменения сломают оба проекта

2. **FK на users.id должен быть Integer**
   ```python
   # Правильно
   user_id = Column(Integer, ForeignKey("users.id"))

   # НЕПРАВИЛЬНО
   user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
   ```

3. **Имя таблицы сделок - `lk_deals`**
   - Избегаем конфликта с потенциальной таблицей `deals` в agent
   - Все LK-таблицы можно префиксить `lk_` при необходимости

4. **Credentials должны совпадать**
   ```
   JWT_SECRET     - одинаковый в agent и lk
   ENCRYPTION_KEY - одинаковый в agent и lk
   ```

5. **При откате миграций LK**
   - Никогда не откатывать миграции agent
   - Откат LK миграций не должен затрагивать users

## Проверка подключения

```bash
# SSH на сервер
ssh -i ~/.ssh/id_housler root@95.163.227.26

# Проверить что lk-backend видит agent-postgres
docker exec lk-backend python -c "
from app.db.session import sync_engine
from sqlalchemy import text
with sync_engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM users'))
    print(f'Users in shared DB: {result.scalar()}')
"

# Проверить сети
docker inspect lk-backend --format '{{json .NetworkSettings.Networks}}' | jq 'keys'
# Должно вернуть: ["housler_agent_network", "lk-network"]
```

## Диагностика проблем

### lk-backend не видит agent-postgres

1. Проверить что external network существует:
   ```bash
   docker network ls | grep housler_agent
   ```

2. Проверить что lk-backend подключен к обеим сетям:
   ```bash
   docker network inspect housler_agent_network | jq '.[0].Containers'
   ```

3. Пересоздать контейнеры:
   ```bash
   cd /root/lk-housler
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d
   ```

### Миграция LK не работает

1. Проверить connection string:
   ```bash
   docker exec lk-backend env | grep DATABASE
   ```

2. Проверить доступ к БД:
   ```bash
   docker exec lk-backend python -c "
   from app.db.session import sync_engine
   print(sync_engine.url)
   "
   ```

## Связанные документы

- [UNIFIED_AUTH.md](./UNIFIED_AUTH.md) - Единая авторизация
- [housler_pervichka/docs/SHARED/SERVER_ACCESS.md](../../housler_pervichka/docs/SHARED/SERVER_ACCESS.md) - Доступ к серверу
