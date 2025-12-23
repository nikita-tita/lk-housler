# 🏠 Agent Deal Platform (lk.housler.ru)

> **Платформа для автоматизации агентских сделок на рынке недвижимости**

[![Backend Status](https://img.shields.io/badge/Backend-Ready%20100%25-success)](./BACKEND_READY.md)
[![Documentation](https://img.shields.io/badge/Docs-Complete-blue)](./NEXT_STEPS.md)
[![Housler Ecosystem](https://img.shields.io/badge/Housler-Integrated-orange)](./HOUSLER_ECOSYSTEM.md)

**Часть экосистемы Housler**  
🏢 ООО "Сектор ИТ" (ИНН 5190237491)

## 🎯 Что это?

Автоматизация агентских сделок на рынке недвижимости:
- ✅ Простая электронная подпись (ПЭП) по 63-ФЗ
- ✅ Платежи через СБП с автоматическим сплитом
- ✅ Merchant of Record модель
- ✅ KYC/AML проверки (115-ФЗ)
- ✅ Шифрование PII (152-ФЗ)
- ✅ Генерация чеков для самозанятых

## 🔐 Авторизация (3 типа)

1. **SMS Auth** - Риелторы (физ. лица)
2. **Email Auth** - Клиенты (покупатели/продавцы)
3. **Email + Password** - Агентства (юр. лица)

📖 **[API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md)** - Полный гайд

## 💰 Платежи

- Создание Payment Intent
- Webhook от СБП
- Автоматическое распределение комиссий
- Генерация чеков (НПД)

📖 **[API_PAYMENTS_GUIDE.md](./API_PAYMENTS_GUIDE.md)** - Полный гайд

## 🏗 Архитектура

**📐 Полная документация**: [ARCHITECTURE.md](./ARCHITECTURE.md)

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

## 🚀 Быстрый старт

### 📋 Чек-лист запуска

**Для нетерпеливых** - [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md)

### 🏃 Автоматический запуск (одна команда)

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
  -d '{"phone": "+79999123456", "code": "111111"}'

# Email Auth (Client)
curl -X POST http://localhost:8000/api/v1/auth/client/email/send \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com"}'

curl -X POST http://localhost:8000/api/v1/auth/client/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com", "code": "111111"}'
```

## 📚 Документация

### 🎯 Начните здесь
- **[QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md)** - Запуск за 5 минут ⚡
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Текущий статус проекта
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - План дальнейших действий

### 🔍 Детальная документация
- [FINAL_REVIEW.md](./FINAL_REVIEW.md) - Полный обзор проекта
- [SETUP.md](./SETUP.md) - Подробная инструкция по установке
- [PROGRESS.md](./PROGRESS.md) - История разработки

### 🔌 API Guides
- **[API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md)** - Авторизация (3 типа)
- **[API_PAYMENTS_GUIDE.md](./API_PAYMENTS_GUIDE.md)** - Платежи и СБП
- [BACKEND_READY.md](./BACKEND_READY.md) - Backend документация

### 🏗 Housler Ecosystem
- [HOUSLER_ECOSYSTEM.md](./HOUSLER_ECOSYSTEM.md) - Главный документ
- [HOUSLER_INTEGRATION.md](./HOUSLER_INTEGRATION.md) - Детали интеграции
- [QUICKSTART_HOUSLER.md](./QUICKSTART_HOUSLER.md) - Быстрый старт Housler
- [CLAUDE.md](./CLAUDE.md) - Инструкции для AI

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

## 🌍 Production Deployment

### Сервер
```
IP: 91.229.8.221
SSH: ssh -i ~/.ssh/id_housler root@91.229.8.221
Порт: 3090
Домен: lk.housler.ru
```

### Deploy
```bash
# На сервере
cd /opt/lk.housler.ru
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

## 📊 Unit-экономика

- **Эквайринг**: 2% от платежа
- **Банк**: 0.7%
- **Платформа**: 1.3%
- **Чистая маржа**: ~0.6% от GMV
- **Минимальный платеж**: 10,000₽

## 🧪 Тестовые данные

### SMS Test Mode
- **Телефоны**: `+79999000000` - `+79999999999`
- **Коды**: `111111` - `666666`

### Email Test Mode
- Все Email логируются в консоль (если `EMAIL_PROVIDER=mock`)

## ✅ Статус проекта

### Backend (95% готов)
- ✅ 3 типа авторизации (SMS, Email, Password)
- ✅ Регистрация с согласиями
- ✅ PII шифрование (152-ФЗ)
- ✅ SMS.RU интеграция
- ✅ Email провайдер (Mock + SMTP)
- ✅ 9 сервисов (Auth, User, Organization, Deal, Document, Signature, Payment, Ledger, Antifraud)
- ✅ Payment endpoints (Create Intent, Webhook, Get Status)
- ✅ Docker + Docker Compose (dev + prod)
- ⏳ Unit тесты
- ⏳ Integration тесты

### Frontend (0% готов)
- ⏳ Agent Console
- ⏳ Client Portal
- ⏳ Agency Admin

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
