# 🚀 Быстрый старт lk.housler.ru

## Что готово прямо сейчас

✅ **Backend полностью работает**
- FastAPI + PostgreSQL + Redis
- SMS.RU интеграция (реальная)
- PII шифрование (152-ФЗ)
- Все сервисы готовы

✅ **Production конфигурация**
- Docker Compose
- Nginx с SSL
- Health checks
- Rate limiting

## Локальный запуск (5 минут)

### 1. Установить зависимости

```bash
cd /Users/fatbookpro/Desktop/lk

# Инфраструктура
docker-compose up -d

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Создать .env

```bash
cd backend

cat > .env << 'EOF'
APP_NAME="Housler LK"
DEBUG=True
SECRET_KEY="dev-secret-key"
JWT_SECRET="dev-jwt-secret"

DATABASE_URL="postgresql+asyncpg://lk_user:lk_password@localhost:5432/lk_db"
DATABASE_URL_SYNC="postgresql://lk_user:lk_password@localhost:5432/lk_db"

REDIS_URL="redis://localhost:6379/0"

# PII Encryption (генерировать для prod!)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# SMS.RU
SMS_PROVIDER="sms_ru"
SMS_RU_API_ID="779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90"
SMS_TEST_MODE="true"

# MinIO
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET_DOCUMENTS="lk-documents"
S3_BUCKET_RECEIPTS="lk-receipts"

CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
EOF
```

### 3. Создать миграцию

```bash
# Создать первую миграцию
alembic revision --autogenerate -m "Housler integration: encryption, consents, roles"

# Применить
alembic upgrade head
```

### 4. Запустить backend

```bash
uvicorn app.main:app --reload --port 8000
```

### 5. Проверить

Откройте: http://localhost:8000/docs

**API готов! 🎉**

---

## Тестирование SMS

### Вариант 1: Тестовый режим (бесплатно)

```bash
# В .env установить:
SMS_TEST_MODE="true"

# Использовать телефоны: 79999000000-79999999999
# Коды: 111111, 222222, 333333, 444444, 555555, 666666
```

**Тест:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999000000", "purpose": "login"}'

# Ответ: {"message": "OTP sent successfully"}
# В консоли: [SMS.RU Test Mode] To: 79999000000...

curl -X POST http://localhost:8000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999000000", "code": "111111", "purpose": "login"}'

# Ответ: {"access_token": "...", "refresh_token": "..."}
```

### Вариант 2: Реальные SMS (~3₽ за SMS)

```bash
# В .env установить:
SMS_TEST_MODE="false"

# Проверить баланс:
curl "https://sms.ru/my/balance?api_id=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90"
```

---

## Production деплой на 91.229.8.221

### Подготовка (один раз)

```bash
# 1. SSH на сервер
ssh -i ~/.ssh/id_housler root@91.229.8.221

# 2. Создать директорию
mkdir -p /var/www/lk.housler.ru
cd /var/www/lk.housler.ru

# 3. Клонировать репозиторий (если есть)
# git clone <repo_url> .
# или скопировать файлы с локального:
# scp -i ~/.ssh/id_housler -r /Users/fatbookpro/Desktop/lk/* root@91.229.8.221:/var/www/lk.housler.ru/
```

### Создать production .env

```bash
cd /var/www/lk.housler.ru

cat > .env << 'EOF'
APP_NAME="Housler LK"
APP_ENV="production"
DEBUG="false"

# Generate: openssl rand -base64 32
SECRET_KEY="REPLACE_WITH_REAL_SECRET"
JWT_SECRET="REPLACE_WITH_REAL_SECRET"

# Database
DB_NAME="lk_housler"
DB_USER="lk_user"
DB_PASSWORD="REPLACE_WITH_REAL_PASSWORD"
DATABASE_URL="postgresql+asyncpg://lk_user:REPLACE@postgres:5432/lk_housler"
DATABASE_URL_SYNC="postgresql://lk_user:REPLACE@postgres:5432/lk_housler"

REDIS_URL="redis://redis:6379/0"

# PII Encryption (Generate: openssl rand -hex 32)
ENCRYPTION_KEY="REPLACE_WITH_64_HEX_CHARS"

# SMS.RU
SMS_PROVIDER="sms_ru"
SMS_RU_API_ID="779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90"
SMS_TEST_MODE="false"

# MinIO
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="REPLACE_WITH_REAL_PASSWORD"
MINIO_ENDPOINT="minio:9000"

CORS_ORIGINS="https://lk.housler.ru"
EOF

# Заменить REPLACE на реальные секреты:
nano .env
```

### Запустить

```bash
# 1. Запустить Docker
docker-compose -f docker-compose.prod.yml up -d --build

# 2. Применить миграции
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head

# 3. Проверить
docker-compose -f docker-compose.prod.yml ps
docker logs lk-backend --tail 50
```

### Настроить Nginx

```bash
# 1. Скопировать конфиг
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/lk.housler.ru.conf /etc/nginx/sites-enabled/

# 2. Проверить
nginx -t

# 3. Применить
systemctl reload nginx

# 4. Получить SSL
certbot --nginx -d lk.housler.ru
```

### Проверить работу

```bash
# Health check
curl https://lk.housler.ru/health

# API docs
# Открыть: https://lk.housler.ru/docs
```

---

## Обновление после изменений

### Локально

```bash
cd /Users/fatbookpro/Desktop/lk
git add -A
git commit -m "feat: описание изменений"
git push origin main
```

### На сервере

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221

cd /var/www/lk.housler.ru
git pull origin main

# Пересобрать и перезапустить
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml up -d

# Если были изменения в моделях - миграция
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic revision --autogenerate -m "Описание"
docker-compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head
```

---

## Полезные команды

### Docker

```bash
# Логи
docker logs lk-backend --tail 100 -f
docker logs lk-postgres --tail 50

# Перезапуск
docker-compose -f docker-compose.prod.yml restart backend

# Остановить всё
docker-compose -f docker-compose.prod.yml down

# Удалить данные (осторожно!)
docker-compose -f docker-compose.prod.yml down -v
```

### База данных

```bash
# Подключиться к PostgreSQL
docker exec -it lk-postgres psql -U lk_user -d lk_housler

# Посмотреть таблицы
\dt

# Выйти
\q
```

### Alembic

```bash
# Текущая версия
docker exec lk-backend alembic current

# История
docker exec lk-backend alembic history

# Откатить миграцию
docker exec lk-backend alembic downgrade -1

# Накатить миграцию
docker exec lk-backend alembic upgrade head
```

---

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи
docker logs lk-backend

# Проверить .env
docker exec lk-backend env | grep -E 'DB_|SMS_|ENCRYPTION'

# Проверить БД
docker exec lk-postgres pg_isready -U lk_user -d lk_housler
```

### SMS не отправляются

```bash
# Проверить баланс SMS.RU
curl "https://sms.ru/my/balance?api_id=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90"

# Проверить логи
docker logs lk-backend | grep SMS

# Включить тестовый режим
# В .env: SMS_TEST_MODE="true"
docker-compose -f docker-compose.prod.yml restart backend
```

### Nginx ошибки

```bash
# Проверить конфигурацию
nginx -t

# Посмотреть логи
tail -f /var/log/nginx/lk.housler.ru.error.log

# Перезапустить
systemctl restart nginx
```

---

## Чеклист перед production

```
[ ] .env создан с реальными секретами
[ ] JWT_SECRET сгенерирован (openssl rand -base64 32)
[ ] ENCRYPTION_KEY сгенерирован (openssl rand -hex 32)
[ ] DB_PASSWORD установлен
[ ] SMS_TEST_MODE="false" для реальных SMS
[ ] Проверен баланс SMS.RU (>100₽)
[ ] Docker контейнеры запущены (docker-compose ps)
[ ] Миграции применены (alembic current)
[ ] Nginx конфиг установлен
[ ] SSL сертификат получен (certbot certificates)
[ ] Health check работает (curl https://lk.housler.ru/health)
[ ] API docs доступны (https://lk.housler.ru/docs)
[ ] Тестовая регистрация работает
```

---

## Что дальше

1. ✅ **Backend работает** — можно тестировать API
2. ⏳ **Адаптировать авторизацию** — добавить email+код для клиентов
3. 📱 **Создать Frontend** — Agent Console, Client Portal
4. 📄 **Добавить /doc страницы** — политики, оферты
5. 🔗 **Интеграции** — Email провайдер, KYC APIs

---

**Быстрый запуск:** 5 минут  
**Полный деплой:** 15 минут  
**Статус:** Готов к использованию  
**Дата:** 23 декабря 2025

