# CLAUDE.md - Инструкции для Claude Code

## Проект

**lk.housler.ru** — Личный кабинет экосистемы Housler

## Технологический стек

### Backend (Python)
- **Framework:** FastAPI
- **ORM:** SQLAlchemy + Alembic (миграции)
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Storage:** MinIO (S3-compatible)
- **Auth:** JWT + SMS/Email коды

### Frontend (планируется)
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Font:** Inter (Google Fonts)

## Структура проекта

```
/Users/fatbookpro/Desktop/lk/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints (v1/...)
│   │   ├── core/          # Конфигурация, security
│   │   ├── db/            # Database connection
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   └── main.py        # FastAPI app
│   ├── alembic/           # Миграции БД
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              # Next.js (будет добавлен)
├── nginx/                 # Nginx конфигурации
├── docker-compose.yml     # Development
├── docker-compose.prod.yml # Production
├── HOUSLER_ECOSYSTEM.md   # Документация экосистемы
└── CLAUDE.md              # Этот файл
```

## Связанные проекты Housler

| Проект | Путь | Стек |
|--------|------|------|
| Agent Housler | `/Users/fatbookpro/Desktop/housler_pervichka` | Node.js + Next.js |
| AI Calendar | `/Users/fatbookpro/Desktop/AI-Calendar-Project/ai-calendar-assistant` | Python + FastAPI |
| Cian Analyzer | `/Users/fatbookpro/Desktop/cian` | Node.js |

## Правила разработки

### Design System (строго соблюдать!)

1. **Только черно-белая палитра** — никаких цветных акцентов
2. **Без эмоджи** — ни в коде, ни в UI, ни в комментариях
3. **Шрифт Inter** — единственный шрифт
4. **Минимализм** — меньше элементов, больше пространства

Полная документация: `docs/DESIGN-SYSTEM.md` в housler_pervichka

### Переиспользование кода

При реализации функционала ВСЕГДА проверяй:
1. **housler_pervichka** — авторизация, SMS, API patterns
2. **AI-Calendar** — Python/FastAPI patterns
3. **Общие компоненты** — UI компоненты, стили

### Авторизация

Копировать логику из `housler_pervichka`:
- SMS авторизация через SMS.RU
- JWT токены (7 дней)
- Шифрование PII (152-ФЗ)
- Тестовые аккаунты

### Типы согласий

```python
class ConsentType(str, Enum):
    PERSONAL_DATA = "personal_data"
    TERMS = "terms"
    MARKETING = "marketing"
    REALTOR_OFFER = "realtor_offer"
    AGENCY_OFFER = "agency_offer"
```

## Команды

### Development

```bash
# Запуск инфраструктуры
docker-compose up -d

# Backend (локально)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Миграции
alembic upgrade head
alembic revision --autogenerate -m "description"
```

### Production

```bash
# Деплой
ssh -i ~/.ssh/id_housler root@91.229.8.221
cd /var/www/lk.housler.ru
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

## Важные файлы для изучения

### Авторизация
- `housler_pervichka/backend/src/services/auth.service.ts`
- `housler_pervichka/backend/src/services/sms.service.ts`
- `housler_pervichka/frontend/src/contexts/AuthContext.tsx`

### API структура
- `housler_pervichka/frontend/src/services/api.ts`
- `housler_pervichka/backend/src/api/`

### Design System
- `housler_pervichka/docs/DESIGN-SYSTEM.md`
- `housler_pervichka/frontend/src/app/globals.css`

### Правовые документы
- `housler_pervichka/frontend/src/app/doc/`

### Деплой
- `housler_pervichka/DEPLOY_INSTRUCTIONS.md`
- `housler_pervichka/nginx/agent.housler.ru.conf`
- `AI-Calendar-Project/ai-calendar-assistant/DEPLOY.md`

## Сервер

- **IP:** 91.229.8.221
- **SSH:** `ssh -i ~/.ssh/id_housler root@91.229.8.221`
- **Порт для lk.housler.ru:** 3090 (внутренний Nginx)

## Переменные окружения

Смотри `.env.example` в корне проекта.

Критичные:
- `JWT_SECRET` — генерировать: `openssl rand -base64 32`
- `ENCRYPTION_KEY` — генерировать: `openssl rand -hex 32`
- `SMS_RU_API_ID` — из SMS.RU кабинета

## Чеклист нового функционала

```
[ ] Проверил аналог в housler_pervichka
[ ] Использовал Design System
[ ] Нет цветных элементов
[ ] Нет эмоджи
[ ] Шифрование PII если нужно
[ ] Миграция создана
[ ] Тесты написаны
```
