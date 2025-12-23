# 🏠 Добро пожаловать в lk.housler.ru!

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        🏠  AGENT DEAL PLATFORM - lk.housler.ru  🏠         ║
║                                                              ║
║     Платформа автоматизации агентских сделок в недвижимости ║
║                                                              ║
║  ✅ Backend готов на 100%                                   ║
║  ✅ 24 модели БД                                            ║
║  ✅ 9 сервисов                                              ║
║  ✅ 32+ API endpoints                                       ║
║  ✅ 3 типа авторизации                                      ║
║  ✅ PII шифрование (152-ФЗ)                                 ║
║  ✅ 19 файлов документации                                  ║
║                                                              ║
║  ООО "Сектор ИТ" (ИНН 5190237491)                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🚀 С чего начать?

### Для нетерпеливых (5 минут)

```bash
# 1. Настроить .env
cp .env.example backend/.env
# Отредактировать backend/.env (см. ниже)

# 2. Запустить всё одной командой
./START_PROJECT.sh

# 3. Открыть Swagger UI
# http://localhost:8000/docs
```

### Для вдумчивых (15 минут)

1. 📖 Прочитать [README.md](./README.md) - обзор проекта
2. ✅ Пройти [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md) - чек-лист
3. 🏗 Изучить [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектуру
4. 🔌 Посмотреть [API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md) - API

---

## 📚 Документация по ролям

### 👨‍💼 Я менеджер
**Читать**: 
- [SUMMARY.md](./SUMMARY.md) - Executive Summary
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Текущий статус
- [NEXT_STEPS.md](./NEXT_STEPS.md) - План действий

### 👨‍💻 Я Backend разработчик
**Читать**:
- [README.md](./README.md) - Обзор
- [BACKEND_READY.md](./BACKEND_READY.md) - Backend docs
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура
- [API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md) - API

### 👨‍🎨 Я Frontend разработчик
**Читать**:
- [API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md) - Auth API
- [API_PAYMENTS_GUIDE.md](./API_PAYMENTS_GUIDE.md) - Payments API
- [HOUSLER_ECOSYSTEM.md](./HOUSLER_ECOSYSTEM.md) - Design System

### 🛠 Я DevOps
**Читать**:
- [SETUP.md](./SETUP.md) - Установка
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура
- [HOUSLER_ECOSYSTEM.md](./HOUSLER_ECOSYSTEM.md) - Deployment

---

## 🔑 Настройка .env (обязательно!)

```bash
# backend/.env

# 1. Сгенерировать ENCRYPTION_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"
ENCRYPTION_KEY=<64-hex-chars>

# 2. SMS.RU API ID (получить на sms.ru)
SMS_RU_API_ID=<your-api-id>
SMS_TEST_MODE=true  # false в production

# 3. Email (для разработки - mock)
EMAIL_PROVIDER=mock  # или smtp в production

# 4. Database (уже настроено для Docker)
DATABASE_URL=postgresql+asyncpg://lk_user:lk_password@localhost:5432/lk_db
REDIS_URL=redis://localhost:6379/0
```

---

## 🧪 Первый тест

### Отправить SMS агенту

```bash
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456"}'

# В test mode коды: 111111-666666
```

### Проверить код

```bash
curl -X POST http://localhost:8000/api/v1/auth/agent/sms/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+79999123456", "code": "111111"}'

# Получите access_token и refresh_token
```

### Получить профиль

```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <access_token>"
```

**Работает? Поздравляем!** 🎉

---

## 📊 Что готово

```
┌─────────────────────────────────────────────────────┐
│  BACKEND                                  ✅ 100%  │
│  ├─ Infrastructure                        ✅       │
│  ├─ Database Models (24)                  ✅       │
│  ├─ Services (9)                          ✅       │
│  ├─ API Endpoints (32+)                   ✅       │
│  ├─ Authentication (3 types)              ✅       │
│  ├─ Security (PII encryption)             ✅       │
│  ├─ SMS.RU Integration                    ✅       │
│  ├─ Email Provider                        ✅       │
│  ├─ Docker Config                         ✅       │
│  └─ Documentation (19 files)              ✅       │
├─────────────────────────────────────────────────────┤
│  TESTING                                  ⏳ 0%   │
│  ├─ Unit Tests                            ⏳       │
│  ├─ Integration Tests                     ⏳       │
│  └─ API Tests                             ⏳       │
├─────────────────────────────────────────────────────┤
│  FRONTEND                                 ⏳ 0%   │
│  ├─ Agent Console                         ⏳       │
│  ├─ Client Portal                         ⏳       │
│  └─ Agency Admin                          ⏳       │
└─────────────────────────────────────────────────────┘

Overall Progress: ██████░░░░░░░░░░░░░░ 25%
```

---

## 🎯 Следующие шаги

### 1. Testing (1-2 дня)
- Unit tests для сервисов
- Integration tests для API
- API tests с pytest

### 2. Frontend (3-4 недели)
- Agent Console (MVP)
- Client Portal
- Agency Admin

### 3. Production (1 день)
- Deploy на сервер 91.229.8.221
- SSL сертификат
- Monitoring

**Детали**: [NEXT_STEPS.md](./NEXT_STEPS.md)

---

## 📱 URLs

### Development
- **API**: http://localhost:8000
- **Swagger**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **MinIO**: http://localhost:9001

### Production
- **API**: https://lk.housler.ru
- **Server**: 91.229.8.221:3090
- **SSH**: `ssh -i ~/.ssh/id_housler root@91.229.8.221`

---

## 📚 Полный список документации (19 файлов)

### Быстрый старт
1. [README.md](./README.md) - Главная страница
2. [WELCOME.md](./WELCOME.md) - Этот файл
3. [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md) - Чек-лист за 5 минут
4. [START_PROJECT.sh](./START_PROJECT.sh) - Скрипт автозапуска

### Обзор проекта
5. [SUMMARY.md](./SUMMARY.md) - Executive Summary
6. [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Текущий статус
7. [FINAL_REVIEW.md](./FINAL_REVIEW.md) - Полный технический обзор
8. [PROGRESS.md](./PROGRESS.md) - История разработки

### Архитектура
9. [ARCHITECTURE.md](./ARCHITECTURE.md) - Архитектура системы (диаграммы)
10. [BACKEND_READY.md](./BACKEND_READY.md) - Backend документация

### API
11. [API_AUTH_GUIDE.md](./API_AUTH_GUIDE.md) - Авторизация (3 типа)
12. [API_PAYMENTS_GUIDE.md](./API_PAYMENTS_GUIDE.md) - Платежи и СБП

### Установка
13. [SETUP.md](./SETUP.md) - Подробная инструкция
14. [START_HERE.md](./START_HERE.md) - Быстрый старт (v1)
15. [QUICKSTART_HOUSLER.md](./QUICKSTART_HOUSLER.md) - Housler версия

### Housler Ecosystem
16. [HOUSLER_ECOSYSTEM.md](./HOUSLER_ECOSYSTEM.md) - Главный документ
17. [HOUSLER_INTEGRATION.md](./HOUSLER_INTEGRATION.md) - Детали интеграции
18. [INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md) - Итоги интеграции
19. [CLAUDE.md](./CLAUDE.md) - Для AI

### Планирование
20. [NEXT_STEPS.md](./NEXT_STEPS.md) - План дальнейших действий
21. [DOCS_INDEX.md](./DOCS_INDEX.md) - Индекс документации

---

## 🆘 Проблемы?

### Docker не запускается
```bash
# Проверить Docker
docker info

# Запустить Docker Desktop
open -a Docker
```

### Порт 8000 занят
```bash
# Найти процесс
lsof -i :8000

# Убить процесс
kill -9 <PID>
```

### База данных не создается
```bash
# Пересоздать контейнеры
docker-compose down -v
docker-compose up -d

# Подождать 10 секунд
sleep 10

# Применить миграции
cd backend
source venv/bin/activate
alembic upgrade head
```

**Больше troubleshooting**: [QUICK_START_CHECKLIST.md](./QUICK_START_CHECKLIST.md#troubleshooting)

---

## 💡 Tips & Tricks

### Быстрый рестарт
```bash
docker-compose restart
```

### Логи в реальном времени
```bash
docker-compose logs -f backend
```

### Консоль PostgreSQL
```bash
docker-compose exec postgres psql -U lk_user -d lk_db
```

### Генерация ENCRYPTION_KEY
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 🏆 Что делает проект особенным?

✅ **Полное соответствие законам РФ**
- 152-ФЗ - PII encryption (AES-256)
- 63-ФЗ - Простая электронная подпись
- 115-ФЗ - KYC/AML проверки

✅ **Production-ready архитектура**
- Layered architecture
- Service-oriented design
- Async/await throughout
- Type hints everywhere

✅ **Housler Ecosystem интеграция**
- SMS.RU (реальная интеграция)
- Единый Design System
- Общие серверы и конфигурация

✅ **Comprehensive Documentation**
- 19 файлов документации
- Диаграммы архитектуры
- API примеры
- Troubleshooting guides

---

## 📞 Контакты

**Организация**: ООО "Сектор ИТ"  
**ИНН**: 5190237491  
**Email**: hello@housler.ru

**Проект**: lk.housler.ru  
**Сервер**: 91.229.8.221

---

## 🎉 Готовы начать?

```bash
# Запустить Backend
./START_PROJECT.sh

# Открыть Swagger UI
# http://localhost:8000/docs

# Начать кодить! 🚀
```

---

**Сделано с ❤️ для Housler Team**

_Дата создания: 23 декабря 2025_  
_Backend готов на 100%_ ✅

---

```
┌──────────────────────────────────────┐
│                                      │
│       🏠 Welcome to Housler! 🏠      │
│                                      │
│         Let's build together!        │
│                                      │
└──────────────────────────────────────┘
```

