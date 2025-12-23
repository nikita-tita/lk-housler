# Единая авторизация Housler

## Обзор

Проекты `lk.housler.ru` и `agent.housler.ru` используют **единую систему авторизации**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ЕДИНАЯ АВТОРИЗАЦИЯ                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   lk.housler.ru                    agent.housler.ru             │
│   ┌───────────┐                    ┌───────────────┐            │
│   │ Frontend  │ ──── Auth API ───> │   Backend     │            │
│   │ (Next.js) │                    │   (Node.js)   │            │
│   └───────────┘                    └───────┬───────┘            │
│         │                                  │                    │
│         │                                  │                    │
│         │        ┌─────────────────────────┘                    │
│         │        │                                              │
│         │        ▼                                              │
│         │   ┌─────────────┐                                     │
│         │   │  PostgreSQL │  housler_agent                      │
│         │   │  (общая БД) │                                     │
│         │   └─────────────┘                                     │
│         │        ▲                                              │
│         │        │                                              │
│   ┌─────┴─────┐  │                                              │
│   │  Backend  │──┘  (подключен к agent-network)                 │
│   │ (FastAPI) │                                                 │
│   └───────────┘                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Критические зависимости

| Компонент | Расположение | Влияние |
|-----------|--------------|---------|
| Auth API | `agent.housler.ru/api/auth/*` | Изменения ломают авторизацию на ОБОИХ сайтах |
| JWT_SECRET | `.env` обоих проектов | Должен быть ОДИНАКОВЫМ |
| ENCRYPTION_KEY | `.env` обоих проектов | Должен быть ОДИНАКОВЫМ |
| База данных | `housler_agent` | Общая для обоих проектов |
| Таблица users | `agent-postgres` | Общая для обоих проектов |

## Как это работает

### 1. SMS авторизация (агенты)

```
lk.housler.ru/login
    │
    ├── POST https://agent.housler.ru/api/auth/request-sms
    │       Body: { "phone": "79991234567" }
    │       Response: { "success": true, "message": "Код отправлен" }
    │
    └── POST https://agent.housler.ru/api/auth/verify-sms
            Body: { "phone": "79991234567", "code": "123456" }
            Response: { "success": true, "token": "...", "user": {...} }
```

### 2. Email авторизация (клиенты)

```
lk.housler.ru/login
    │
    ├── POST https://agent.housler.ru/api/auth/request-code
    │       Body: { "email": "client@mail.ru" }
    │
    └── POST https://agent.housler.ru/api/auth/verify-code
            Body: { "email": "client@mail.ru", "code": "123456" }
```

### 3. Пароль (агентства)

```
lk.housler.ru/login
    │
    └── POST https://agent.housler.ru/api/auth/login-agency
            Body: { "email": "admin@agency.ru", "password": "..." }
```

## Тестовые данные

| Тип | Идентификатор | Код |
|-----|---------------|-----|
| SMS | `79999xxxxxx` | `111111`, `222222`, `333333`, `444444`, `555555`, `666666` |
| Email | `*@test.housler.ru` | `111111`, `222222`, `333333`, `444444`, `555555`, `666666` |

## Правила изменений

### НЕЛЬЗЯ менять без согласования:

1. **Эндпоинты auth API** в `agent.housler.ru`
   - `/api/auth/request-sms`
   - `/api/auth/verify-sms`
   - `/api/auth/request-code`
   - `/api/auth/verify-code`
   - `/api/auth/login-agency`
   - `/api/auth/me`

2. **Формат ответа** auth endpoints

3. **Структуру таблицы `users`** в БД

4. **JWT_SECRET** и **ENCRYPTION_KEY**

### При изменении auth в agent.housler.ru:

1. Проверить совместимость с `lk.housler.ru`
2. Обновить оба проекта одновременно
3. Задеплоить оба проекта

## Конфигурация

### agent.housler.ru (.env)

```env
DB_HOST=postgres
DB_NAME=housler_agent
JWT_SECRET=***REMOVED***
ENCRYPTION_KEY=***REMOVED***
```

### lk.housler.ru (.env)

```env
# Подключение к БД agent.housler.ru
DB_HOST=agent-postgres
DB_NAME=housler_agent
DB_USER=housler
DB_PASSWORD=***REMOVED***

# ВАЖНО: Должны совпадать с agent.housler.ru
JWT_SECRET=***REMOVED***
ENCRYPTION_KEY=***REMOVED***
```

### lk.housler.ru (frontend)

```typescript
// lib/api/client.ts
const AUTH_API_URL = 'https://agent.housler.ru/api';
```

## Docker сети

```
agenthouslerru_agent-network
    ├── agent-frontend
    ├── agent-backend
    ├── agent-postgres  ◄── Общая БД
    ├── agent-redis
    ├── agent-nginx
    └── lk-backend      ◄── Подключен к обеим сетям

lkhouslerru_lk-network
    ├── lk-frontend
    ├── lk-backend
    ├── lk-redis
    ├── lk-minio
    └── lk-nginx
```

## Диагностика

### Проверить подключение lk-backend к agent-postgres:

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221
docker exec lk-backend python -c "
from app.db.session import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM users'))
    print(f'Users count: {result.scalar()}')
"
```

### Проверить сети контейнера:

```bash
docker inspect lk-backend --format '{{json .NetworkSettings.Networks}}' | jq
```

### Тест авторизации:

```bash
# Отправить SMS
curl -X POST https://agent.housler.ru/api/auth/request-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "79999222222"}'

# Проверить код
curl -X POST https://agent.housler.ru/api/auth/verify-sms \
  -H "Content-Type: application/json" \
  -d '{"phone": "79999222222", "code": "111111"}'
```

## Общие компоненты (Shared Components)

Некоторые UI компоненты синхронизированы между проектами:

| Компонент | agent.housler.ru | lk.housler.ru |
|-----------|-----------------|---------------|
| Footer | `src/components/Footer.tsx` | `components/shared/Footer.tsx` |
| CookieBanner | `src/components/CookieBanner.tsx` | `components/shared/CookieBanner.tsx` |

### Правила синхронизации

1. **Источник правды** - `agent.housler.ru`
2. При изменении компонента в agent.housler.ru - скопировать в lk.housler.ru
3. Компоненты в lk.housler.ru содержат `@sync-with` комментарий с путем к оригиналу
4. Ссылки на документы ведут на `agent.housler.ru` (там хранятся все правовые документы)

### Чеклист при обновлении:

```
[ ] Изменен компонент в agent.housler.ru
[ ] Скопировано изменение в lk.housler.ru
[ ] Проверено на обоих сайтах
[ ] Задеплоены оба проекта
```

## Контакты

При проблемах с авторизацией проверять ОБА проекта:
- `agent.housler.ru` - основной auth provider
- `lk.housler.ru` - использует auth через API
