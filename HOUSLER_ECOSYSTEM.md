# Housler Ecosystem - Руководство для lk.housler.ru

## Обзор экосистемы Housler

### Проекты и домены

| Проект | Домен | Директория | Описание |
|--------|-------|------------|----------|
| Agent Housler | agent.housler.ru | `/Users/fatbookpro/Desktop/housler_pervichka` | Платформа для риелторов (первичка) |
| AI Calendar | calendar.housler.ru | `/Users/fatbookpro/Desktop/AI-Calendar-Project/ai-calendar-assistant` | AI-календарь |
| Cian Analyzer | housler.ru | `/Users/fatbookpro/Desktop/cian` | Анализатор Циан |
| **LK Housler** | **lk.housler.ru** | **`/Users/fatbookpro/Desktop/lk`** | **Личный кабинет (текущий проект)** |

### Сервер

- **IP:** `91.229.8.221`
- **Хостинг:** reg.ru Cloud (Ubuntu)
- **SSH ключ:** `~/.ssh/id_housler`
- **SSH команда:** `ssh -i ~/.ssh/id_housler root@91.229.8.221`

---

## 1. Юридическая информация (копировать точь-в-точь)

### Реквизиты компании

```
ООО "Сектор ИТ"
ИНН: 5190237491
КПП: 519001001
ОГРН: 1255100001496
Адрес: 183008, Мурманская область, г. Мурманск, ул. Олега Кошевого, д. 6 к. 1, помещ. 1
Email: hello@housler.ru
```

### Структура правовых документов

```
/doc
├── /doc                        # Главная страница документов
├── /doc/clients                # Для клиентов
│   ├── /politiki/privacy       # Политика конфиденциальности
│   └── /soglasiya
│       ├── /personal-data      # Согласие на обработку ПД
│       ├── /cookie             # Согласие на cookie
│       └── /terms              # Пользовательское соглашение
├── /doc/realtors               # Для риелторов
│   └── /oferta                 # Оферта для самозанятых
└── /doc/agents                 # Для агентств
    └── /oferta                 # Договор-оферта для агентств
```

### Типы согласий (consent types)

```typescript
const consentTypes = {
  personalData: 'personal_data',    // Согласие на обработку ПД
  terms: 'terms',                   // Пользовательское соглашение
  marketing: 'marketing',           // Маркетинговые рассылки
  realtorOffer: 'realtor_offer',    // Оферта для риелторов
  agencyOffer: 'agency_offer'       // Оферта для агентств
};
```

---

## 2. Авторизация и регистрация

### Способы входа

1. **Клиенты** — Email + код (6 цифр)
2. **Частные риелторы** — SMS + код (6 цифр)
3. **Сотрудники агентств** — Email + пароль

### SMS-авторизация (SMS.RU)

```env
# .env
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90
SMS_TEST_MODE=false
```

**Тестовые аккаунты (бесплатно):**
- Телефоны: `79999000000` - `79999999999`
- Коды: `111111`, `222222`, `333333`, `444444`, `555555`, `666666`

**Стоимость:** ~3 руб/SMS

### API Endpoints авторизации

```typescript
// Email авторизация (клиенты)
POST /api/auth/request-code     { email: string }
POST /api/auth/verify-code      { email: string, code: string }

// SMS авторизация (риелторы)
POST /api/auth/request-sms      { phone: string }
POST /api/auth/verify-sms       { phone: string, code: string }

// Регистрация риелтора
POST /api/auth/register-realtor {
  phone: string,
  name: string,
  email: string,
  city?: string,
  isSelfEmployed?: boolean,
  personalInn?: string,
  consents: {
    personalData: boolean,
    terms: boolean,
    realtorOffer: boolean,
    marketing?: boolean
  }
}

// Регистрация агентства
POST /api/auth/register-agency {
  inn: string,
  name: string,
  legalAddress: string,
  contactName: string,
  contactPhone: string,
  contactEmail: string,
  password: string,
  consents: {...}
}

// Вход агентства
POST /api/auth/login-agency     { email: string, password: string }

// Профиль
GET /api/auth/me
```

### Роли пользователей

```typescript
type UserRole = 'client' | 'agent' | 'agency_admin' | 'operator' | 'admin';
```

### JWT токен

```typescript
interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
  agencyId: number | null;
}

// Срок жизни: 7 дней
// Хранение: localStorage['housler_token']
// Header: Authorization: Bearer <token>
```

---

## 3. Design System

### Принципы

1. **Только черный и белый** — без цветных акцентов
2. **Без эмоджи** — ни в коде, ни в UI
3. **Минимализм** — меньше элементов
4. **Консистентность** — одинаковые паттерны
5. **Переиспользование** — не дублировать

### Цветовая палитра

```css
:root {
  /* Основа */
  --black: #000000;
  --white: #FFFFFF;

  /* Серая шкала */
  --gray-900: #181A20;  /* Основной текст, primary кнопки */
  --gray-800: #333333;
  --gray-700: #4A4A4A;
  --gray-600: #6B7280;  /* Вторичный текст */
  --gray-500: #9CA3AF;
  --gray-400: #D1D5DB;
  --gray-300: #E5E7EB;  /* Границы */
  --gray-200: #F3F4F6;  /* Hover фон */
  --gray-100: #F9FAFB;  /* Фоны секций */

  /* Семантические алиасы */
  --color-text: var(--gray-900);
  --color-text-secondary: var(--gray-600);
  --color-border: var(--gray-300);
  --color-bg: var(--white);
  --color-bg-secondary: var(--gray-100);
  --color-bg-hover: var(--gray-200);
  --color-accent: var(--black);
}
```

### Типографика

**Шрифт:** Inter (Google Fonts)

```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});
```

**Размеры:**
- `text-xs` (12px) — подписи, метаданные
- `text-sm` (14px) — вторичный текст
- `text-base` (16px) — основной текст
- `text-lg` (18px) — подзаголовки
- `text-xl` (20px) — заголовки карточек
- `text-2xl` (24px) — заголовки блоков
- `text-3xl` (32px) — заголовки страниц

### Компоненты

**Кнопки:**
```css
.btn-primary   /* Черный фон, белый текст */
.btn-secondary /* Прозрачный, серая граница */
.btn-ghost     /* Прозрачный, без границы */
```

**Размеры кнопок:**
```css
.btn-sm { padding: 8px 16px; font-size: 14px; }
.btn    { padding: 12px 24px; font-size: 15px; }
.btn-lg { padding: 16px 32px; font-size: 16px; }
```

**Инпуты:**
```css
.input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}
```

**Карточки:**
```css
.card {
  background: var(--white);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
```

**Badges:**
```css
.badge        /* Серый фон */
.badge-filled /* Черный фон, белый текст */
```

---

## 4. Деплой на сервер

### Структура на сервере

```
/var/www/agent.housler.ru/           # Agent Housler (первичка)
├── .env                              # Конфигурация
├── backend/                          # Node.js API
├── frontend/                         # Next.js
└── docker-compose.prod.yml

/root/ai-calendar-assistant/ai-calendar-assistant/
├── .env
├── app/
└── docker-compose.secure.yml
```

### Деплой lk.housler.ru

```bash
# 1. Создать директорию
ssh -i ~/.ssh/id_housler root@91.229.8.221
mkdir -p /var/www/lk.housler.ru

# 2. Клонировать репозиторий
cd /var/www/lk.housler.ru
git clone <repo_url> .

# 3. Создать .env
cp .env.example .env
nano .env

# 4. Запустить Docker
docker-compose -f docker-compose.prod.yml up -d

# 5. Настроить Nginx
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/lk.housler.ru.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 6. Получить SSL сертификат
certbot --nginx -d lk.housler.ru
```

### Nginx конфигурация (шаблон)

```nginx
# /etc/nginx/sites-available/lk.housler.ru

server {
    listen 80;
    server_name lk.housler.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name lk.housler.ru;

    ssl_certificate /etc/letsencrypt/live/lk.housler.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lk.housler.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    client_max_body_size 20M;

    # Proxy to Docker
    location / {
        proxy_pass http://127.0.0.1:3090;  # Выбрать свободный порт
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Обновление после изменений

```bash
# Локально
git add -A && git commit -m "feat: описание" && git push origin main

# На сервере
ssh -i ~/.ssh/id_housler root@91.229.8.221 '
  cd /var/www/lk.housler.ru &&
  git pull origin main &&
  docker-compose -f docker-compose.prod.yml build --no-cache &&
  docker-compose -f docker-compose.prod.yml up -d
'
```

---

## 5. Переменные окружения

### .env.example для lk.housler.ru

```env
# ===========================================
# Database (PostgreSQL)
# ===========================================
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lk_housler
DB_USER=lk_user
DB_PASSWORD=SECURE_PASSWORD_HERE
DATABASE_URL=postgresql://lk_user:SECURE_PASSWORD_HERE@postgres:5432/lk_housler

# ===========================================
# Redis
# ===========================================
REDIS_URL=redis://redis:6379

# ===========================================
# Application
# ===========================================
NODE_ENV=production
API_PORT=3001
NEXT_PUBLIC_API_URL=https://lk.housler.ru/api

# ===========================================
# Authentication
# ===========================================
# openssl rand -base64 32
JWT_SECRET=GENERATE_SECURE_SECRET
JWT_EXPIRES_IN=7d

# ===========================================
# PII Encryption (152-ФЗ)
# ===========================================
# openssl rand -hex 32
ENCRYPTION_KEY=GENERATE_32_BYTE_HEX_KEY

# ===========================================
# SMS Provider (SMS.RU)
# ===========================================
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=779FBF5C-56D6-6AF8-5C8B-63C2F6CF9C90
SMS_TEST_MODE=false

# ===========================================
# Yandex Cloud (AI)
# ===========================================
YANDEX_GPT_FOLDER_ID=your_folder_id
YANDEX_GPT_API_KEY=your_api_key

# ===========================================
# MinIO (S3-compatible storage)
# ===========================================
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=minio:9000
```

---

## 6. Безопасность

### Firewall (UFW)

```bash
# Только эти порты открыты
22/tcp   # SSH (только по ключам)
80/tcp   # HTTP (редирект на HTTPS)
443/tcp  # HTTPS
```

### Fail2ban

```bash
# Активные jail'ы
- sshd              # Брутфорс SSH
- nginx-env-scan   # Сканеры .env
- nginx-botsearch  # Поиск уязвимостей
- nginx-http-auth  # Брутфорс авторизации
```

### Критически запрещено

```
- Открывать Redis наружу (6379)
- Открывать PostgreSQL наружу (5432)
- Хранить секреты в git
- Логировать пароли/токены
- Коммитить .env файлы
```

### Шифрование PII (152-ФЗ)

```typescript
// Поля, требующие шифрования
- email (+ email_encrypted, email_hash)
- phone (+ phone_encrypted, phone_hash)
- name (+ name_encrypted)
- personal_inn (+ personal_inn_encrypted, personal_inn_hash)

// Алгоритм: AES-256
// Хеши: SHA-256 (для поиска)
```

---

## 7. Docker Compose (production)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: lk-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - lk-network

  redis:
    image: redis:7-alpine
    container_name: lk-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb
    volumes:
      - redis_data:/data
    networks:
      - lk-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: lk-backend
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - lk-network

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_URL: https://lk.housler.ru
    container_name: lk-frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - lk-network

  nginx:
    image: nginx:alpine
    container_name: lk-nginx
    restart: unless-stopped
    ports:
      - "127.0.0.1:3090:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - lk-network

volumes:
  postgres_data:
  redis_data:

networks:
  lk-network:
    driver: bridge
```

---

## 8. Полезные команды

### SSH

```bash
# Подключение
ssh -i ~/.ssh/id_housler root@91.229.8.221

# Или через alias (добавить в ~/.ssh/config)
Host housler-server
    HostName 91.229.8.221
    User root
    IdentityFile ~/.ssh/id_housler
```

### Docker

```bash
# Логи
docker logs lk-backend --tail 100 -f

# Перезапуск
docker-compose -f docker-compose.prod.yml restart backend

# Пересборка
docker-compose -f docker-compose.prod.yml build --no-cache backend
docker-compose -f docker-compose.prod.yml up -d
```

### База данных

```bash
# Подключение к PostgreSQL
docker exec -it lk-postgres psql -U lk_user -d lk_housler

# Миграции (Alembic)
docker exec -it lk-backend alembic upgrade head
```

### SSL сертификат

```bash
# Получить сертификат
certbot --nginx -d lk.housler.ru

# Проверить
certbot certificates

# Обновить
certbot renew
```

---

## 9. Чеклист перед деплоем

```
[ ] Код закоммичен и запушен
[ ] .env создан на сервере
[ ] JWT_SECRET сгенерирован
[ ] ENCRYPTION_KEY сгенерирован (32 bytes hex)
[ ] SMS_RU_API_ID установлен
[ ] Nginx конфиг создан
[ ] SSL сертификат получен
[ ] Docker контейнеры запущены
[ ] Health check проходит
[ ] Тестовый логин работает
```

---

## 10. Контакты и ресурсы

**Сервер:**
- IP: 91.229.8.221
- SSH: `ssh -i ~/.ssh/id_housler root@91.229.8.221`

**Домены:**
- agent.housler.ru — Agent Housler
- calendar.housler.ru — AI Calendar
- housler.ru — Cian Analyzer
- lk.housler.ru — Личный кабинет (этот проект)

**SMS.RU:**
- Кабинет: https://sms.ru
- API docs: https://sms.ru/api/send
- Проверка баланса: `curl "https://sms.ru/my/balance?api_id=<API_ID>"`

**Let's Encrypt:**
- Certbot: `certbot --nginx -d lk.housler.ru`
