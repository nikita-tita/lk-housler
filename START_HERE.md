# 🚀 Начало работы

## Что уже сделано

✅ **Базовая архитектура платформы агентских сделок**
- Backend API (FastAPI + PostgreSQL + Redis)
- 18 database models (Users, Organizations, Deals, Documents, Payments, Ledger)
- Auth система (OTP через SMS)
- Создание организаций и агентов
- Создание сделок
- Генерация договоров в PDF
- Все endpoints документированы в Swagger

## Быстрый запуск (5 минут)

### 1. Запустить инфраструктуру

```bash
# Перейти в папку проекта
cd /Users/fatbookpro/Desktop/lk

# Запустить Docker Compose (PostgreSQL, Redis, MinIO)
docker-compose up -d

# Проверить, что всё запустилось
docker-compose ps
```

### 2. Настроить backend

```bash
cd backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt

# Создать .env файл
cat > .env << EOF
APP_NAME="LK Agent Deals Platform"
DEBUG=True
SECRET_KEY="dev-secret-key-change-in-production"
JWT_SECRET_KEY="dev-jwt-secret-key"

DATABASE_URL="postgresql+asyncpg://lk_user:lk_password@localhost:5432/lk_db"
DATABASE_URL_SYNC="postgresql://lk_user:lk_password@localhost:5432/lk_db"

REDIS_URL="redis://localhost:6379/0"
CELERY_BROKER_URL="redis://localhost:6379/1"
CELERY_RESULT_BACKEND="redis://localhost:6379/2"

S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_DOCUMENTS="lk-documents"
S3_BUCKET_RECEIPTS="lk-receipts"

JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

OTP_LENGTH=6
OTP_EXPIRE_MINUTES=5
OTP_MAX_ATTEMPTS=3
OTP_BLOCK_MINUTES=10

SMS_PROVIDER="mock"
PAYMENT_PROVIDER="mock"

MIN_PAYMENT_AMOUNT=10000
MAX_PAYMENT_AMOUNT=10000000

CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
EOF

# Создать миграцию БД
alembic revision --autogenerate -m "Initial schema"

# Применить миграцию
alembic upgrade head

# Запустить сервер
uvicorn app.main:app --reload
```

### 3. Проверить работу

Откройте в браузере:
- **Swagger UI**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health
- **MinIO Console**: http://localhost:9001 (admin/minioadmin)

## Тестирование API

### 1. Регистрация/вход через OTP

```bash
# Отправить OTP
curl -X POST http://localhost:8000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79001234567", "purpose": "login"}'

# Посмотрите код в консоли backend (Mock SMS)
# Увидите: [SMS Mock] To: +79001234567, Message: Ваш код подтверждения: 123456

# Верифицировать OTP и получить токены
curl -X POST http://localhost:8000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79001234567", "code": "123456", "purpose": "login"}'

# Сохраните access_token из ответа
```

### 2. Работа с профилем

```bash
# Получить текущего пользователя
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Создать профиль
curl -X POST http://localhost:8000/api/v1/users/me/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Иван Иванов",
    "inn": "123456789012",
    "tax_status": "npd",
    "address": "Москва, ул. Ленина, д. 1"
  }'
```

### 3. Создание организации (агентства)

```bash
curl -X POST http://localhost:8000/api/v1/organizations/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "agency",
    "legal_name": "ООО Агентство недвижимости",
    "inn": "1234567890",
    "kpp": "123456789",
    "ogrn": "1234567890123",
    "legal_address": "Москва, ул. Ленина, д. 1",
    "default_split_percent_agent": 60
  }'

# Сохраните organization_id из ответа
```

### 4. Создание сделки

```bash
curl -X POST http://localhost:8000/api/v1/deals/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "secondary_buy",
    "executor_type": "user",
    "executor_id": "YOUR_USER_ID",
    "client_phone": "+79009999999",
    "client_name": "Петр Петров",
    "property_address": "Москва, ул. Пушкина, д. 10, кв. 5",
    "terms": {
      "commission_total": 150000,
      "payment_plan": [
        {"step": 1, "amount": 50000, "trigger": "immediate"},
        {"step": 2, "amount": 100000, "trigger": "registration_confirmed"}
      ],
      "split_rule": {"agent": 100}
    }
  }'

# Сохраните deal_id из ответа
```

### 5. Генерация договора

```bash
curl -X POST http://localhost:8000/api/v1/documents/deals/YOUR_DEAL_ID/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Получите document_id и file_url
# Можете скачать PDF по file_url
```

## Структура проекта

```
lk/
├── backend/              # FastAPI Backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Config, security
│   │   ├── db/          # Database setup
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   │   ├── auth/
│   │   │   ├── user/
│   │   │   ├── organization/
│   │   │   ├── deal/
│   │   │   ├── document/
│   │   │   ├── sms/
│   │   │   └── storage/
│   │   └── main.py
│   ├── alembic/         # Migrations
│   └── requirements.txt
├── docker-compose.yml
├── README.md
├── SETUP.md
├── PROGRESS.md
└── START_HERE.md (этот файл)
```

## Что дальше?

### Реализовано ✅
1. ✅ Auth система (OTP, JWT)
2. ✅ User & Organization Service
3. ✅ Deal Service
4. ✅ Document Service (генерация PDF)

### В разработке 🚧
5. 🚧 Signature Service (ПЭП подписание)
6. 🚧 Payment Service (СБП интеграция)
7. 🚧 Ledger Service (проводки, сплиты)
8. 🚧 Antifraud Service

### Планируется 📋
9. 📋 Frontend (Agent Console)
10. 📋 Frontend (Client Portal)
11. 📋 Frontend (Agency Admin)
12. 📋 Реальные интеграции (SMS, KYC, СБП)

## Полезные ссылки

- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Помощь

### Логи
```bash
# Backend logs
cd backend
tail -f *.log

# Docker logs
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f minio
```

### Сброс БД
```bash
cd backend
alembic downgrade base
alembic upgrade head
```

### Остановить всё
```bash
docker-compose down
# Или с удалением данных:
docker-compose down -v
```

---

**Версия**: 0.1.0 MVP  
**Дата**: 23 декабря 2025  
**Статус**: В разработке

🎯 **Цель MVP**: Полный цикл сделки от создания до оплаты с ПЭП-подписанием

