# Deployment Guide - lk.housler.ru

## Оглавление
1. [Подготовка к деплою](#подготовка-к-деплою)
2. [Размещение на GitHub](#размещение-на-github)
3. [Деплой на сервер](#деплой-на-сервер)
4. [Настройка Nginx](#настройка-nginx)
5. [SSL сертификаты](#ssl-сертификаты)
6. [Проверка работоспособности](#проверка-работоспособности)
7. [Обновление приложения](#обновление-приложения)
8. [Мониторинг и логи](#мониторинг-и-логи)
9. [Откат изменений](#откат-изменений)

---

## Подготовка к деплою

### 1. Проверка локального окружения

Убедитесь, что у вас установлены:
- Git
- Docker и Docker Compose
- SSH ключ для доступа к серверу

### 2. Создание production переменных окружения

Создайте файл `.env.production` в корне проекта:

```bash
# Database
DB_NAME=lk_housler
DB_USER=lk_user
DB_PASSWORD=<СГЕНЕРИРУЙТЕ_НАДЕЖНЫЙ_ПАРОЛЬ>

# JWT Secret (32+ символов)
JWT_SECRET=<СГЕНЕРИРУЙТЕ_СЛУЧАЙНУЮ_СТРОКУ>

# Encryption Key (64 hex символа для AES-256)
ENCRYPTION_KEY=<СГЕНЕРИРУЙТЕ_HEX_КЛЮЧ>

# SMS.RU
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=<ВАШ_API_ID>
SMS_TEST_MODE=false

# MinIO (S3)
MINIO_ROOT_USER=<СГЕНЕРИРУЙТЕ_ЛОГИН>
MINIO_ROOT_PASSWORD=<СГЕНЕРИРУЙТЕ_ПАРОЛЬ>

# Next.js
NEXT_PUBLIC_API_URL=https://lk.housler.ru
```

**Генерация ключей:**

```bash
# JWT Secret
openssl rand -base64 32

# Encryption Key (64 hex символа)
openssl rand -hex 32

# Пароли
openssl rand -base64 24
```

---

## Размещение на GitHub

### 1. Инициализация Git репозитория

```bash
cd /Users/fatbookpro/Desktop/lk

# Инициализация
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: Backend + Frontend complete"
```

### 2. Создание репозитория на GitHub

1. Перейдите на https://github.com
2. Нажмите "New repository"
3. Название: `lk-housler` (или любое другое)
4. Описание: "Agent Deal Platform - lk.housler.ru"
5. Выберите **Private** (рекомендуется)
6. **НЕ** инициализируйте с README, .gitignore или лицензией
7. Нажмите "Create repository"

### 3. Подключение к GitHub

```bash
# Добавьте remote (замените YOUR_USERNAME на ваш логин GitHub)
git remote add origin https://github.com/YOUR_USERNAME/lk-housler.git

# Или через SSH (если настроен SSH ключ)
git remote add origin git@github.com:YOUR_USERNAME/lk-housler.git

# Отправка кода
git branch -M main
git push -u origin main
```

### 4. Настройка GitHub Secrets (опционально)

Для CI/CD можно настроить GitHub Actions:

1. Settings → Secrets and variables → Actions
2. Добавьте секреты:
   - `SERVER_HOST`: 91.229.8.221
   - `SERVER_USER`: root
   - `SSH_PRIVATE_KEY`: содержимое ~/.ssh/id_housler
   - `ENV_FILE`: содержимое .env.production

---

## Деплой на сервер

### 1. Подключение к серверу

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221
```

### 2. Установка необходимых пакетов (если еще не установлены)

```bash
# Обновление системы
apt update && apt upgrade -y

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Compose
apt install docker-compose -y

# Git
apt install git -y

# Nginx (если еще не установлен)
apt install nginx -y

# Certbot для SSL
apt install certbot python3-certbot-nginx -y
```

### 3. Создание директории для проекта

```bash
# Создание директории
mkdir -p /var/www/lk.housler.ru
cd /var/www/lk.housler.ru

# Клонирование репозитория
git clone https://github.com/YOUR_USERNAME/lk-housler.git .

# Или через SSH
git clone git@github.com:YOUR_USERNAME/lk-housler.git .
```

### 4. Настройка переменных окружения

```bash
# Создание .env файла
nano .env
```

Вставьте содержимое `.env.production` (см. раздел "Подготовка к деплою")

**Важно:** Убедитесь, что все секретные ключи уникальны и надежны!

### 5. Создание необходимых директорий

```bash
# Логи
mkdir -p logs/backend logs/nginx

# Права доступа
chmod -R 755 logs
```

### 6. Запуск приложения

```bash
# Сборка и запуск контейнеров
docker-compose -f docker-compose.prod.yml up -d --build

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Просмотр логов
docker-compose -f docker-compose.prod.yml logs -f
```

### 7. Проверка работы контейнеров

```bash
# Проверка всех контейнеров
docker ps

# Проверка логов backend
docker logs lk-backend

# Проверка логов frontend
docker logs lk-frontend

# Проверка логов nginx
docker logs lk-nginx

# Проверка здоровья
curl http://localhost:3090/health
curl http://localhost:3090/api/health
```

---

## Настройка Nginx

### 1. Копирование конфигурации Nginx

```bash
# Копирование конфига
cp /var/www/lk.housler.ru/nginx/lk.housler.ru.conf /etc/nginx/sites-available/lk.housler.ru

# Создание симлинка
ln -s /etc/nginx/sites-available/lk.housler.ru /etc/nginx/sites-enabled/

# Удаление дефолтного конфига (если есть)
rm /etc/nginx/sites-enabled/default
```

### 2. Проверка конфигурации

```bash
# Проверка синтаксиса
nginx -t

# Если все OK, перезагрузка
systemctl reload nginx
```

### 3. Проверка статуса Nginx

```bash
systemctl status nginx
```

---

## SSL сертификаты

### 1. Получение сертификата Let's Encrypt

```bash
# Автоматическая настройка SSL
certbot --nginx -d lk.housler.ru

# Следуйте инструкциям:
# - Введите email для уведомлений
# - Согласитесь с условиями
# - Выберите редирект HTTP -> HTTPS (рекомендуется)
```

### 2. Автоматическое обновление сертификатов

```bash
# Проверка автообновления
certbot renew --dry-run

# Cron уже настроен автоматически при установке certbot
# Можно проверить:
systemctl list-timers | grep certbot
```

### 3. Ручное обновление (если нужно)

```bash
certbot renew
systemctl reload nginx
```

---

## Проверка работоспособности

### 1. Проверка доступности

```bash
# Проверка HTTP
curl -I http://lk.housler.ru

# Проверка HTTPS
curl -I https://lk.housler.ru

# Проверка API
curl https://lk.housler.ru/api/health

# Проверка backend напрямую
curl http://localhost:3090/api/health
```

### 2. Проверка в браузере

Откройте в браузере:
- https://lk.housler.ru - главная страница (должен редиректить на /login)
- https://lk.housler.ru/login - страница логина
- https://lk.housler.ru/api/health - API health check

### 3. Проверка базы данных

```bash
# Подключение к контейнеру postgres
docker exec -it lk-postgres psql -U lk_user -d lk_housler

# Проверка таблиц
\dt

# Выход
\q
```

### 4. Проверка Redis

```bash
# Подключение к Redis
docker exec -it lk-redis redis-cli

# Проверка
PING
# Должен ответить: PONG

# Выход
exit
```

### 5. Проверка MinIO

```bash
# MinIO доступен только внутри Docker сети
# Проверка через backend logs
docker logs lk-backend | grep -i minio
```

---

## Обновление приложения

### 1. Обновление кода

```bash
# Подключение к серверу
ssh -i ~/.ssh/id_housler root@91.229.8.221

# Переход в директорию проекта
cd /var/www/lk.housler.ru

# Получение последних изменений
git pull origin main

# Пересборка и перезапуск контейнеров
docker-compose -f docker-compose.prod.yml up -d --build

# Проверка логов
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Обновление только backend

```bash
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### 3. Обновление только frontend

```bash
docker-compose -f docker-compose.prod.yml up -d --build frontend
```

### 4. Применение миграций базы данных

```bash
# Миграции применяются автоматически при запуске backend
# Но можно запустить вручную:
docker exec lk-backend alembic upgrade head
```

---

## Мониторинг и логи

### 1. Просмотр логов

```bash
# Все контейнеры
docker-compose -f docker-compose.prod.yml logs -f

# Только backend
docker-compose -f docker-compose.prod.yml logs -f backend

# Только frontend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Последние 100 строк
docker-compose -f docker-compose.prod.yml logs --tail=100 backend

# Логи Nginx (системный)
tail -f /var/log/nginx/lk.housler.ru.access.log
tail -f /var/log/nginx/lk.housler.ru.error.log

# Логи Nginx (Docker)
docker logs lk-nginx -f
```

### 2. Мониторинг ресурсов

```bash
# Использование ресурсов контейнерами
docker stats

# Дисковое пространство
df -h

# Использование Docker
docker system df
```

### 3. Очистка старых образов и контейнеров

```bash
# Удаление неиспользуемых образов
docker image prune -a

# Удаление неиспользуемых volumes
docker volume prune

# Полная очистка (осторожно!)
docker system prune -a --volumes
```

---

## Откат изменений

### 1. Откат к предыдущему коммиту

```bash
# Просмотр истории коммитов
git log --oneline

# Откат к конкретному коммиту
git checkout <commit-hash>

# Пересборка
docker-compose -f docker-compose.prod.yml up -d --build
```

### 2. Откат через Git

```bash
# Откат последнего коммита
git revert HEAD

# Откат к предыдущей версии
git reset --hard HEAD~1

# Пересборка
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. Быстрый откат через Docker образы

```bash
# Просмотр образов
docker images

# Использование старого образа
docker tag lk-backend:old lk-backend:latest
docker-compose -f docker-compose.prod.yml up -d backend
```

---

## Резервное копирование

### 1. Backup базы данных

```bash
# Создание backup
docker exec lk-postgres pg_dump -U lk_user lk_housler > backup_$(date +%Y%m%d_%H%M%S).sql

# Или с gzip
docker exec lk-postgres pg_dump -U lk_user lk_housler | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### 2. Восстановление базы данных

```bash
# Из обычного backup
docker exec -i lk-postgres psql -U lk_user lk_housler < backup_20231215_120000.sql

# Из gzip
gunzip < backup_20231215_120000.sql.gz | docker exec -i lk-postgres psql -U lk_user lk_housler
```

### 3. Backup MinIO данных

```bash
# Backup volume
docker run --rm -v lk_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio_backup_$(date +%Y%m%d).tar.gz /data
```

### 4. Автоматический backup (cron)

```bash
# Редактирование crontab
crontab -e

# Добавьте строку для ежедневного backup в 3:00
0 3 * * * docker exec lk-postgres pg_dump -U lk_user lk_housler | gzip > /var/backups/lk_housler_$(date +\%Y\%m\%d).sql.gz

# Очистка старых backup (старше 30 дней)
0 4 * * * find /var/backups -name "lk_housler_*.sql.gz" -mtime +30 -delete
```

---

## Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Проверка логов
docker-compose -f docker-compose.prod.yml logs

# Проверка конфигурации
docker-compose -f docker-compose.prod.yml config

# Пересоздание контейнеров
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Проблема: База данных недоступна

```bash
# Проверка статуса postgres
docker ps | grep postgres

# Проверка логов
docker logs lk-postgres

# Перезапуск
docker-compose -f docker-compose.prod.yml restart postgres
```

### Проблема: 502 Bad Gateway

```bash
# Проверка backend
docker logs lk-backend

# Проверка nginx
docker logs lk-nginx
nginx -t

# Проверка портов
netstat -tulpn | grep 3090

# Перезапуск nginx
systemctl restart nginx
```

### Проблема: SSL сертификат не работает

```bash
# Проверка сертификата
certbot certificates

# Обновление сертификата
certbot renew --force-renewal

# Перезагрузка nginx
systemctl reload nginx
```

---

## Безопасность

### 1. Firewall (UFW)

```bash
# Установка UFW
apt install ufw -y

# Разрешение SSH
ufw allow 22/tcp

# Разрешение HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Включение firewall
ufw enable

# Проверка статуса
ufw status
```

### 2. Fail2Ban для защиты от брутфорса

```bash
# Установка
apt install fail2ban -y

# Настройка для Nginx
nano /etc/fail2ban/jail.local
```

Добавьте:

```ini
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/lk.housler.ru.error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/lk.housler.ru.error.log
```

```bash
# Перезапуск
systemctl restart fail2ban

# Проверка статуса
fail2ban-client status
```

### 3. Обновление системы

```bash
# Регулярные обновления
apt update && apt upgrade -y

# Автоматические обновления безопасности
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades
```

---

## Полезные команды

```bash
# Перезапуск всех контейнеров
docker-compose -f docker-compose.prod.yml restart

# Остановка всех контейнеров
docker-compose -f docker-compose.prod.yml stop

# Запуск всех контейнеров
docker-compose -f docker-compose.prod.yml start

# Удаление всех контейнеров
docker-compose -f docker-compose.prod.yml down

# Удаление с volumes (ОСТОРОЖНО! Удалит базу данных)
docker-compose -f docker-compose.prod.yml down -v

# Проверка использования портов
netstat -tulpn | grep LISTEN

# Проверка процессов Docker
docker ps -a

# Вход в контейнер
docker exec -it lk-backend bash
docker exec -it lk-frontend sh

# Проверка переменных окружения в контейнере
docker exec lk-backend env
```

---

## Контакты и поддержка

- **Сервер:** 91.229.8.221
- **SSH:** `ssh -i ~/.ssh/id_housler root@91.229.8.221`
- **Домен:** https://lk.housler.ru
- **GitHub:** https://github.com/YOUR_USERNAME/lk-housler

---

## Чеклист деплоя

- [ ] Создан `.env.production` с надежными ключами
- [ ] Код загружен на GitHub
- [ ] Подключение к серверу работает
- [ ] Docker и Docker Compose установлены
- [ ] Проект склонирован на сервер
- [ ] `.env` файл создан на сервере
- [ ] Контейнеры запущены и работают
- [ ] Nginx настроен и работает
- [ ] SSL сертификат получен и работает
- [ ] Проверена доступность через браузер
- [ ] Настроен автоматический backup
- [ ] Настроен firewall (UFW)
- [ ] Настроен fail2ban
- [ ] Документация обновлена

---

**Готово! Ваше приложение развернуто и работает на https://lk.housler.ru**

