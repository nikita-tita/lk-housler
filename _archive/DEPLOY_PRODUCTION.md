# LK Housler - Production Deployment Guide

> **Последнее обновление:** Январь 2026

## Сервер

| Параметр | Значение |
|----------|----------|
| **Хостинг** | [reg.ru Cloud](https://cloud.reg.ru/panel/servers/5344931/network) |
| **IP** | 95.163.227.26 |
| **SSH** | `ssh root@95.163.227.26` |
| **Пароль** | `NsUurH93jSHNW8QS` |
| **Путь проекта** | `/root/lk` |
| **URL** | https://lk.housler.ru |
| **Порт** | 3090 |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX                                │
│                    (lk.housler.ru:443)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ proxy_pass :3090
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      lk-nginx                                │
│                   (127.0.0.1:3090)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│    lk-frontend      │         │    lk-backend       │
│   (Next.js :3000)   │         │  (FastAPI :8000)    │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
          ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
          │  agent-postgres │   │   agent-redis   │   │    lk-minio     │
          │ (housler_lk DB) │   │                 │   │   (S3 storage)  │
          └─────────────────┘   └─────────────────┘   └─────────────────┘
```

---

## Контейнеры

| Контейнер | Описание | Порт |
|-----------|----------|------|
| `lk-frontend` | Next.js frontend | 3000 |
| `lk-backend` | FastAPI backend | 8000 |
| `lk-celery-worker` | Celery worker | - |
| `lk-nginx` | Reverse proxy | 3090 |
| `lk-minio` | S3-совместимое хранилище | 9000, 9001 |

**Зависимости (из agent.housler.ru):**
- `agent-postgres` — PostgreSQL (база `housler_lk`)
- `agent-redis` — Redis

---

## Первый деплой

### 1. Клонирование репозитория

```bash
ssh root@95.163.227.26
cd /root
git clone <repo-url> lk
cd lk
```

### 2. Создание базы данных

```bash
# Подключиться к PostgreSQL
docker exec -it agent-postgres psql -U housler -d postgres

# Создать базу
CREATE DATABASE housler_lk WITH OWNER housler;
\c housler_lk

# Создать enum для ролей
CREATE TYPE user_role AS ENUM ('client', 'agent', 'agency_admin', 'operator', 'admin');

# Создать таблицу users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'client',
    is_active BOOLEAN DEFAULT true,
    agency_id INTEGER,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    phone_verified BOOLEAN DEFAULT false,
    city VARCHAR(100),
    is_self_employed BOOLEAN DEFAULT false,
    personal_inn VARCHAR(12),
    password_hash VARCHAR(255),
    registration_status VARCHAR(20) DEFAULT 'active',
    email_hash VARCHAR(64),
    phone_hash VARCHAR(64),
    name_encrypted TEXT,
    phone_encrypted TEXT,
    email_encrypted TEXT,
    personal_inn_encrypted TEXT,
    personal_inn_hash VARCHAR(64),
    preferred_contact VARCHAR(20) DEFAULT 'phone',
    telegram_username VARCHAR(100),
    whatsapp_phone VARCHAR(20),
    avatar_url VARCHAR(500),
    experience_years INTEGER,
    about TEXT,
    legal_data_filled BOOLEAN DEFAULT false
);

\q
```

### 3. Настройка .env

```bash
cd /root/lk
cp .env.example .env
nano .env
```

**Критические переменные:**
```env
# Database - использует отдельную базу housler_lk
DATABASE_URL=postgresql://housler:YourPassword@agent-postgres:5432/housler_lk
DATABASE_URL_SYNC=postgresql://housler:YourPassword@agent-postgres:5432/housler_lk

# Redis - использует redis из agent.housler.ru
REDIS_URL=redis://agent-redis:6379/1

# ВАЖНО: должны совпадать с agent.housler.ru
ENCRYPTION_KEY=<same_as_agent>
ENCRYPTION_SALT=<same_as_agent>

# Production settings
APP_ENV=production
DEBUG=false
SMS_TEST_MODE=false

# Frontend URL
FRONTEND_URL=https://lk.housler.ru
NEXT_PUBLIC_API_URL=https://lk.housler.ru/api
```

### 4. Запуск контейнеров

```bash
cd /root/lk
docker compose -f docker-compose.prod.yml up -d --build
```

### 5. Проверка

```bash
# Статус контейнеров
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep lk

# Логи backend
docker logs lk-backend --tail 50

# Health check
curl -s http://127.0.0.1:3090/api/health
```

---

## Обычный деплой (обновление)

```bash
# С локальной машины
ssh root@95.163.227.26 "cd /root/lk && git pull && docker compose -f docker-compose.prod.yml up -d --build"

# Или на сервере
cd /root/lk
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

### Zero-downtime обновление

```bash
cd /root/lk

# Обновить только backend
docker compose -f docker-compose.prod.yml up -d --build --no-deps lk-backend

# Обновить только frontend
docker compose -f docker-compose.prod.yml up -d --build --no-deps lk-frontend
```

---

## Важные особенности

### База данных

- lk.housler.ru использует **отдельную базу** `housler_lk`
- Причина: конфликт схем таблицы `deals` с agent.housler.ru
- PostgreSQL сервер общий (`agent-postgres`), но база своя

### Шифрование (152-ФЗ)

- `ENCRYPTION_KEY` и `ENCRYPTION_SALT` **ДОЛЖНЫ совпадать** между lk.housler.ru и agent.housler.ru
- Иначе не получится расшифровать общие данные пользователей

### Внешняя сеть Docker

docker-compose.prod.yml подключается к сети `agent-housler_agent-network`:

```yaml
networks:
  agent-network:
    external: true
    name: agent-housler_agent-network
```

---

## Логи и мониторинг

```bash
# Все логи
docker compose -f docker-compose.prod.yml logs -f

# Backend логи
docker logs lk-backend -f --tail 100

# Frontend логи
docker logs lk-frontend -f --tail 100

# Celery worker логи
docker logs lk-celery-worker -f --tail 100
```

---

## Troubleshooting

### Backend не запускается

```bash
# Проверить логи
docker logs lk-backend --tail 100

# Частые проблемы:
# 1. База не существует → создать housler_lk
# 2. SMS_TEST_MODE=true в production → установить false
# 3. Нет таблицы users → выполнить SQL из раздела "Первый деплой"
```

### Проблемы с подключением к PostgreSQL

```bash
# Проверить что agent-postgres работает
docker ps | grep agent-postgres

# Проверить сеть
docker network ls | grep agent

# Проверить подключение изнутри контейнера
docker exec lk-backend python -c "from app.db.session import engine; print(engine.url)"
```

### Frontend не работает

```bash
# Проверить что backend доступен
curl http://127.0.0.1:3090/api/health

# Проверить nginx конфиг в контейнере
docker exec lk-nginx cat /etc/nginx/conf.d/default.conf
```

---

## Откат изменений

```bash
cd /root/lk

# Посмотреть коммиты
git log --oneline -5

# Откатиться
git checkout <commit-hash>

# Пересобрать
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Связанные документы

- [housler_pervichka/DEPLOY.md](../housler_pervichka/DEPLOY.md) — Главный гайд по всем проектам
- [SETUP.md](./SETUP.md) — Локальная разработка
- [.env.example](./.env.example) — Пример переменных окружения
