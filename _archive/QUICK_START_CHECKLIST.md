# ✅ Чек-лист быстрого старта

## 🚀 Запуск за 5 минут

### ✅ Шаг 1: Подготовка окружения (1 мин)

- [ ] Docker Desktop запущен
- [ ] Python 3.11+ установлен
- [ ] Git репозиторий склонирован

### ✅ Шаг 2: Настройка переменных (2 мин)

```bash
cd /Users/fatbookpro/Desktop/lk

# Скопировать .env
cp .env.example backend/.env
```

**Обязательно отредактировать** `backend/.env`:

```env
# 1. Сгенерировать ENCRYPTION_KEY (Python):
# python3 -c "import secrets; print(secrets.token_hex(32))"
ENCRYPTION_KEY=<64-hex-chars>

# 2. SMS.RU API ID (получить на sms.ru)
SMS_RU_API_ID=<your-api-id>

# 3. Test mode (для разработки)
SMS_TEST_MODE=true
EMAIL_PROVIDER=mock
```

### ✅ Шаг 3: Автозапуск (2 мин)

```bash
# Один скрипт делает всё:
# - Запускает Docker (PostgreSQL, Redis, MinIO)
# - Создает venv и устанавливает зависимости
# - Применяет миграции БД
# - Запускает Backend

./START_PROJECT.sh
```

**Или вручную**:

```bash
# 1. Запустить Docker
docker-compose up -d

# 2. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Миграции
alembic revision --autogenerate -m "Initial"
alembic upgrade head

# 4. Запуск
uvicorn app.main:app --reload
```

### ✅ Шаг 4: Проверка (30 сек)

Открыть браузер:

- [ ] http://localhost:8000 - API работает
- [ ] http://localhost:8000/docs - Swagger UI загружается
- [ ] http://localhost:8000/redoc - ReDoc загружается

---

## 🧪 Тестирование API

### Тест 1: SMS Auth (агент)

```bash
# Отправить SMS
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456"}'

# Проверить код (в test mode коды: 111111-666666)
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456", "code": "111111"}'
```

**Ожидаемый результат**:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### Тест 2: Email Auth (клиент)

```bash
# Отправить Email
curl -X POST http://localhost:8000/api/v1/auth/client/email/send \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com"}'

# Проверить код
curl -X POST http://localhost:8000/api/v1/auth/client/email/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "client@test.com", "code": "111111"}'
```

### Тест 3: Получить профиль

```bash
# Используем токен из предыдущего теста
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <access_token>"
```

---

## 📊 Проверка работы сервисов

### Docker services

```bash
docker-compose ps
```

**Должны быть running**:
- ✅ `lk-postgres-1` - PostgreSQL (5432)
- ✅ `lk-redis-1` - Redis (6379)
- ✅ `lk-minio-1` - MinIO (9000, 9001)

### Логи

```bash
# Backend логи
docker-compose logs -f backend

# PostgreSQL логи
docker-compose logs -f postgres

# Все логи
docker-compose logs -f
```

---

## 🔧 Troubleshooting

### Проблема: Docker не запускается

**Решение**:
```bash
# Проверить Docker
docker info

# Если ошибка - запустить Docker Desktop
open -a Docker
```

### Проблема: Порт 8000 занят

**Решение**:
```bash
# Найти процесс
lsof -i :8000

# Убить процесс
kill -9 <PID>

# Или использовать другой порт
uvicorn app.main:app --reload --port 8001
```

### Проблема: База данных не создается

**Решение**:
```bash
# Остановить все контейнеры
docker-compose down -v

# Удалить volumes
docker volume prune

# Запустить заново
docker-compose up -d
```

### Проблема: Миграция не применяется

**Решение**:
```bash
cd backend
source venv/bin/activate

# Проверить статус
alembic current

# Если нет миграций - создать
alembic revision --autogenerate -m "Initial"

# Применить
alembic upgrade head

# Проверить снова
alembic current
```

---

## 📝 Полезные команды

### Docker

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Рестарт
docker-compose restart

# Логи
docker-compose logs -f

# Статус
docker-compose ps

# Удалить всё (включая volumes)
docker-compose down -v
```

### Backend

```bash
cd backend

# Активировать venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows

# Установить зависимости
pip install -r requirements.txt

# Запуск dev сервера
uvicorn app.main:app --reload

# Запуск на другом порту
uvicorn app.main:app --reload --port 8001

# Запуск с debug логами
uvicorn app.main:app --reload --log-level debug
```

### Alembic (миграции)

```bash
cd backend
source venv/bin/activate

# Создать миграцию
alembic revision --autogenerate -m "Description"

# Применить миграции
alembic upgrade head

# Откатить последнюю
alembic downgrade -1

# Показать текущую версию
alembic current

# История миграций
alembic history

# Откатить все
alembic downgrade base
```

### Database

```bash
# Подключиться к PostgreSQL
docker-compose exec postgres psql -U lk_user -d lk_db

# Список таблиц
\dt

# Описание таблицы
\d users

# Выход
\q
```

---

## 🎯 После успешного запуска

### 1. Проверить Swagger UI
- http://localhost:8000/docs
- Протестировать все endpoints через интерфейс

### 2. Изучить документацию
- [API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md) - Полный гайд по авторизации
- [API_PAYMENTS_GUIDE.md](./API_PAYMENTS_GUIDE.md) - Гайд по платежам
- [BACKEND_READY.md](./BACKEND_READY.md) - Backend документация

### 3. Написать тесты
- Unit tests для сервисов
- Integration tests для API
- См. [NEXT_STEPS.md](./NEXT_STEPS.md)

### 4. Начать Frontend
- Setup Next.js проекта
- Интеграция с Backend API
- См. [NEXT_STEPS.md](./NEXT_STEPS.md)

---

## ✅ Готово!

**Backend запущен и работает!** 🎉

Теперь можно:
- ✅ Тестировать API через Swagger
- ✅ Писать тесты
- ✅ Начинать Frontend разработку
- ✅ Интегрировать реальные сервисы

**Следующий шаг**: [NEXT_STEPS.md](./NEXT_STEPS.md)

