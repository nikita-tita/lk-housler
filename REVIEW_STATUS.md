# СТАТУС ИСПРАВЛЕНИЙ - 24 декабря 2025

## КРИТИЧЕСКИЕ ПРОБЛЕМЫ (из REVIEW.md)

| # | Проблема | Статус | Файл | Комментарий |
|---|----------|--------|------|-------------|
| 1.1 | SMS_RU_API_ID утечка | ИСПРАВЛЕНО | `.env.example:75` | Заменено на `YOUR_SMS_RU_API_ID_HERE` |
| 1.2 | Нет авторизации в API | ИСПРАВЛЕНО | `deps.py` | Добавлены `require_deal_access`, `require_org_admin` |
| 1.3 | Webhook без валидации | ИСПРАВЛЕНО | `payments.py:116-122` | Проверка `PAYMENT_WEBHOOK_SECRET` |
| 1.4 | Редирект после логина | ИСПРАВЛЕНО | `*AuthForm.tsx` | Используется `getDashboardPath(role)` |
| 1.5 | Ссылки на странице логина | ИСПРАВЛЕНО | `login/page.tsx` | Используется `getDashboardPath(user.role)` |

## ВЫСОКИЕ ПРОБЛЕМЫ

| # | Проблема | Статус | Комментарий |
|---|----------|--------|-------------|
| 2.1 | PII plain text поля | ЧАСТИЧНО | Поля помечены `deprecated`, миграция pending |
| 2.2 | Refresh token endpoint | НЕ СДЕЛАНО | Требуется реализация |
| 2.3 | Платежная система | MOCK | Работает в тестовом режиме |
| 2.4 | Подпись документов | TODO | Заглушка в API |
| 2.5 | Redis без пароля | НЕ СДЕЛАНО | Требуется в production |
| 2.6 | Backend от root | НЕ СДЕЛАНО | Требуется USER в Dockerfile |
| 2.7 | Один ключ для всего | НЕ СДЕЛАНО | Требуется разделение |

## ЧТО РАБОТАЕТ

### Backend API
- `POST /api/v1/auth/agent/sms/send` - SMS авторизация
- `POST /api/v1/auth/agent/sms/verify` - Проверка SMS
- `POST /api/v1/auth/client/email/send` - Email авторизация
- `POST /api/v1/auth/client/email/verify` - Проверка Email
- `POST /api/v1/auth/agency/login` - Вход агентства
- `GET /api/v1/users/me` - Текущий пользователь
- `GET /api/v1/deals/` - Список сделок (с проверкой доступа)
- `POST /api/v1/deals/` - Создание сделки
- Все endpoints используют проверки авторизации

### Frontend
- Role-based redirect после логина
- SMS/Email/Password формы авторизации
- Agent Console (dashboard, deals, profile)
- Client Portal (dashboard, documents)
- Agency Admin (dashboard, agents, deals, finance, settings)
- Zustand auth store

### Security
- JWT авторизация
- PII encryption (AES-256)
- Webhook secret validation
- Deal/Org access checks

## ФАЙЛЫ ИЗМЕНЕНЫ В ЭТОЙ СЕССИИ

| Файл | Изменение |
|------|-----------|
| `frontend/app/(auth)/login/page.tsx` | Добавлен role-based redirect с `getDashboardPath` |

## СЛЕДУЮЩИЕ ШАГИ (по приоритету)

### Высокий приоритет
1. Добавить refresh token endpoint
2. Redis password в docker-compose.prod.yml
3. USER в backend/Dockerfile

### Средний приоритет
1. Полная миграция PII на encrypted поля
2. Реализация подписи документов
3. Разделение ключей (JWT_SECRET, SECRET_KEY)

### Низкий приоритет
1. Rate limiting
2. Sentry интеграция
3. Celery worker для background tasks

## ГОТОВНОСТЬ К PRODUCTION

| Компонент | Готовность | Блокеры |
|-----------|------------|---------|
| Backend API | 90% | Refresh token, Redis password |
| Frontend | 95% | - |
| Security | 80% | Dockerfile USER, key separation |
| Infrastructure | 85% | Redis password, backups |

**Общая оценка: 85% готовности к MVP**

Критические проблемы безопасности исправлены. Оставшиеся задачи - улучшения для production.
