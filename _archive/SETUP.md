# Инструкция по запуску

## Быстрый старт

### 1. Запуск инфраструктуры

```bash
# Запустить PostgreSQL, Redis, MinIO
docker-compose up -d

# Проверить статус
docker-compose ps
```

### 2. Backend

```bash
cd backend

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или venv\Scripts\activate  # Windows

# Установить зависимости
pip install -r requirements.txt

# Скопировать .env
cp .env.example .env
# Отредактируйте .env при необходимости

# Запустить миграции
alembic upgrade head

# Запустить сервер
uvicorn app.main:app --reload

# API доступен на http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

### 3. Frontend (в разработке)

```bash
cd frontend/agent-console
npm install
npm run dev

# Откроется на http://localhost:5173
```

## Структура проекта

```
lk/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Config, security
│   │   ├── db/          # Database
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # Business logic
│   │   └── main.py      # App entry point
│   ├── alembic/         # DB migrations
│   └── tests/           # Tests
├── frontend/
│   ├── agent-console/   # Агент ЛК
│   ├── client-portal/   # Клиент ЛК
│   └── agency-admin/    # Агентство ЛК
└── docker-compose.yml   # Инфраструктура
```

## Первые шаги разработки

### Создание первой миграции

```bash
cd backend
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### Тестирование API

1. Зарегистрироваться/войти:

```bash
# Отправить OTP
curl -X POST http://localhost:8000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79001234567", "purpose": "login"}'

# Посмотреть код в консоли backend (Mock SMS)
# Верифицировать OTP
curl -X POST http://localhost:8000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79001234567", "code": "123456", "purpose": "login"}'

# Получите access_token
```

2. Использовать API с токеном:

```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Roadmap реализации

- [x] Инфраструктура (Docker, DB)
- [x] Auth & User Service
- [ ] Organization Service
- [ ] Deal Service
- [ ] Document Service
- [ ] Signature Service (ПЭП)
- [ ] Payment Service (СБП)
- [ ] Ledger Service
- [ ] Antifraud Service
- [ ] Frontend: Agent Console
- [ ] Frontend: Client Portal
- [ ] Frontend: Agency Admin

## Полезные команды

```bash
# Посмотреть логи
docker-compose logs -f

# Остановить инфраструктуру
docker-compose down

# Очистить данные (WARNING: удаляет все данные!)
docker-compose down -v

# Запустить тесты
cd backend
pytest

# Форматирование кода
black app/
flake8 app/

# Создать новую миграцию
alembic revision --autogenerate -m "Description"
```

## Troubleshooting

### База данных не подключается

```bash
# Проверить, что PostgreSQL запущен
docker-compose ps postgres

# Пересоздать контейнер
docker-compose restart postgres
```

### Ошибки импорта

```bash
# Убедиться, что виртуальное окружение активировано
which python  # должен указывать на venv

# Переустановить зависимости
pip install -r requirements.txt --force-reinstall
```

