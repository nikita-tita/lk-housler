# Agent Deal Platform (lk.housler.ru)

> Платформа для автоматизации агентских сделок на рынке недвижимости

[![Backend Status](https://img.shields.io/badge/Backend-Ready-success)]()
[![Bank Split](https://img.shields.io/badge/Bank_Split-95%25-blue)](./docs/features/bank-split/README.md)
[![Housler Ecosystem](https://img.shields.io/badge/Housler-Integrated-orange)](./CLAUDE.md)

**Часть экосистемы Housler**
ООО "Сектор ИТ" (ИНН 5190237491)

## 🎯 Что это?

Автоматизация агентских сделок на рынке недвижимости:
- ✅ Простая электронная подпись (ПЭП) по 63-ФЗ
- ✅ Платежи через СБП с автоматическим сплитом
- ✅ Merchant of Record модель
- ✅ KYC/AML проверки (115-ФЗ)
- ✅ Шифрование PII (152-ФЗ)
- ✅ Генерация чеков для самозанятых

## Авторизация (3 типа)

1. **SMS Auth** - Риелторы (физ. лица)
2. **Email Auth** - Клиенты (покупатели/продавцы)
3. **Email + Password** - Агентства (юр. лица)

**[docs/UNIFIED_AUTH.md](./docs/UNIFIED_AUTH.md)** - Полная документация авторизации

## Платежи (Bank Split)

- **Instant Split** через Т-Банк (номинальный счёт)
- Webhook от СБП
- Автоматическое распределение комиссий
- Генерация чеков (НПД)

**[docs/features/bank-split/](./docs/features/bank-split/)** - Документация Bank Split

## Архитектура

**Полная документация**: [docs/features/bank-split/ARCHITECTURE.md](./docs/features/bank-split/ARCHITECTURE.md)

### Backend ✅
- **Framework**: FastAPI (Python 3.11+)
- **БД**: PostgreSQL 15 (24 таблицы)
- **Cache**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Encryption**: AES-256 (PII), SHA-256 (search hashes)
- **SMS**: SMS.RU (готово)
- **Email**: SMTP / Mock (готово)

### Frontend ⏳ (TODO)
- **Framework**: Next.js 14+
- **UI**: Tailwind CSS (черно-белая палитра, шрифт Inter)
- **State**: Zustand + React Query

## 📁 Структура проекта

```
lk/
├── backend/              # Backend API (FastAPI)
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   │   └── v1/
│   │   │       └── endpoints/
│   │   │           ├── auth.py          # ✅ 3 типа авторизации
│   │   │           ├── users.py         # ✅ User CRUD
│   │   │           ├── organizations.py # ✅ Agency CRUD
│   │   │           ├── deals.py         # ✅ Deal management
│   │   │           ├── documents.py     # ✅ PDF генерация
│   │   │           └── payments.py      # ✅ СБП интеграция
│   │   ├── core/        # Конфигурация, security, encryption
│   │   ├── db/          # Database setup
│   │   ├── models/      # SQLAlchemy models (9 сервисов)
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Бизнес-логика
│   │   │   ├── auth/    # ✅ 3 типа входа + регистрация
│   │   │   ├── sms/     # ✅ SMS.RU интеграция
│   │   │   ├── email/   # ✅ Email провайдер
│   │   │   ├── user/    # ✅ User service
│   │   │   ├── organization/ # ✅ Organization service
│   │   │   ├── deal/    # ✅ Deal service
│   │   │   ├── document/ # ✅ Document service
│   │   │   ├── signature/ # ✅ Signature service (ПЭП)
│   │   │   ├── payment/ # ✅ Payment service
│   │   │   ├── ledger/  # ✅ Ledger service
│   │   │   ├── antifraud/ # ✅ Antifraud service
│   │   │   └── storage/ # ✅ S3 storage
│   │   └── main.py
│   ├── alembic/         # Миграции БД
│   └── requirements.txt
├── frontend/            # TODO
│   ├── agent-console/   # ЛК агента
│   ├── client-portal/   # ЛК клиента
│   └── agency-admin/    # ЛК агентства
├── nginx/               # Nginx конфигурации
│   ├── lk.housler.ru.conf  # Внешний сервер
│   └── nginx.conf          # Docker proxy
├── docker-compose.yml      # Dev
├── docker-compose.prod.yml # Prod
└── .env.example
```

## Быстрый старт

### Автоматический запуск (одна команда)

```bash
# Настроить backend/.env (см. ниже)
# Затем запустить:
./START_PROJECT.sh
```

Этот скрипт:
- ✅ Запускает Docker (PostgreSQL, Redis, MinIO)
- ✅ Создает venv и устанавливает зависимости
- ✅ Применяет миграции БД
- ✅ Запускает Backend на http://localhost:8000

### ⚙️ Ручной запуск

```bash
# 1. Настроить .env
cp .env.example backend/.env
# Отредактировать backend/.env:
# - ENCRYPTION_KEY (python3 -c "import secrets; print(secrets.token_hex(32))")
# - SMS_RU_API_ID
# - SMS_TEST_MODE=true

# 2. Запустить Docker
docker-compose up -d

# 3. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Миграции
alembic revision --autogenerate -m "Initial"
alembic upgrade head

# 5. Запуск
uvicorn app.main:app --reload
```

**URLs**:
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 3. Тестирование Auth

```bash
# SMS Auth (Agent)
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456"}'

curl -X POST http://localhost:8000/api/v1/auth/agent/sms/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456", "code": "123456"}'

# Email Auth (Client)
curl -X POST http://localhost:8000/api/v1/auth/client/email/send \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com"}'

curl -X POST http://localhost:8000/api/v1/auth/client/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com", "code": "123456"}'
```

## Документация

### Основная документация
- **[CLAUDE.md](./CLAUDE.md)** - Инструкции для разработки (AI и люди)
- **[BACKLOG.md](./BACKLOG.md)** - Единый бэклог задач

### Авторизация
- **[docs/UNIFIED_AUTH.md](./docs/UNIFIED_AUTH.md)** - Единая авторизация через agent.housler.ru

### Bank Split (Платежи)
- **[docs/features/bank-split/README.md](./docs/features/bank-split/README.md)** - Обзор фичи
- **[docs/features/bank-split/SPEC.md](./docs/features/bank-split/SPEC.md)** - Спецификация
- **[docs/features/bank-split/ARCHITECTURE.md](./docs/features/bank-split/ARCHITECTURE.md)** - Архитектура

### Команда
- **[team/TEAM.md](./team/TEAM.md)** - Структура команды
- **[team/TASKS_2026-01-17.md](./team/TASKS_2026-01-17.md)** - Текущие задачи

## 🗄️ База данных

### Основные модели

1. **User & UserProfile** - Пользователи (с PII шифрованием)
2. **Organization & OrganizationMember** - Агентства
3. **Deal & DealParty** - Сделки
4. **Document** - Документы (PDF)
5. **Payment & PaymentIntent** - Платежи
6. **LedgerEntry & Split** - Бухгалтерия
7. **Receipt & NPDTask** - Чеки
8. **AntifraudCheck & UserLimit** - Антифрод

### Миграции

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "Description"

# Применить миграции
alembic upgrade head

# Откатить на шаг назад
alembic downgrade -1
```

## 🔒 Безопасность

### PII Encryption (152-ФЗ)

Все персональные данные шифруются AES-256:
- Email (encrypted + hash)
- Телефон (encrypted + hash)
- ФИО (encrypted)
- ИНН (encrypted + hash)

### Consent Types

- `personal_data` - Обработка персональных данных ✅
- `terms` - Условия использования ✅
- `marketing` - Маркетинговые рассылки
- `realtor_offer` - Оферта для риелторов
- `agency_offer` - Оферта для агентств

### User Roles

- `client` - Клиенты
- `agent` - Риелторы
- `agency_admin` - Администраторы агентств
- `operator` - Операторы системы
- `admin` - Системные администраторы

## Production Deployment

### Сервер
```
IP: 95.163.227.26
SSH: ssh -i ~/.ssh/id_housler root@95.163.227.26
Путь: /root/lk-housler
Домен: lk.housler.ru
```

### Deploy
```bash
# На сервере
ssh -i ~/.ssh/id_housler root@95.163.227.26
cd /root/lk-housler
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

См. **[DEPLOY.md](./DEPLOY.md)** для подробных инструкций.

## 📊 Unit-экономика

- **Эквайринг**: 2% от платежа
- **Банк**: 0.7%
- **Платформа**: 1.3%
- **Чистая маржа**: ~0.6% от GMV
- **Минимальный платеж**: 10,000₽

## 🧪 Тестовые данные

### SMS Test Mode
- **Телефоны**: `+79999000000` - `+79999999999`
- **Код**: `123456` (фиксированный, настраивается через `SMS_TEST_CODE`)

### Email Test Mode
- Все Email логируются в консоль (если `EMAIL_PROVIDER=mock`)

## Статус проекта

### Backend (READY)
- [x] 3 типа авторизации (SMS, Email, Password)
- [x] Регистрация с согласиями
- [x] PII шифрование (152-ФЗ)
- [x] SMS.RU интеграция
- [x] Email провайдер (Mock + SMTP)
- [x] 9 сервисов (Auth, User, Organization, Deal, Document, Signature, Payment, Ledger, Antifraud)
- [x] Bank Split (Instant Split через Т-Банк) - 95%
- [x] Docker + Docker Compose (dev + prod)
- [x] Unit тесты (111 passed)

### Frontend (IN PROGRESS)
- [x] Payment page (Bank Split)
- [ ] Agent Console
- [ ] Client Portal
- [ ] Agency Admin

## 🔗 Связанные проекты Housler

1. **housler_pervichka** - agent.housler.ru (Node.js + Next.js)
2. **AI-Calendar-Project** - calendar.housler.ru (Python + FastAPI)
3. **cian** - housler.ru

## 📞 Контакты

**Организация:** ООО "Сектор ИТ"  
**ИНН:** 5190237491  
**Email:** hello@housler.ru

---

Made with ❤️ by Housler Team
