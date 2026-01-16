# 📋 Пошаговая инструкция по деплою lk.housler.ru

Эта инструкция содержит все команды для деплоя проекта от начала до конца.

---

## ✅ Часть 1: Подготовка и загрузка на GitHub (Локально)

### Шаг 1: Генерация секретных ключей

```bash
cd /Users/fatbookpro/Desktop/lk

# Генерация ключей
./scripts/generate-keys.sh

# Сохраните вывод - эти ключи понадобятся для .env на сервере
```

### Шаг 2: Создание репозитория на GitHub

1. Откройте https://github.com/new
2. Заполните:
   - **Repository name**: `lk-housler`
   - **Description**: `Agent Deal Platform - lk.housler.ru`
   - **Visibility**: Private (рекомендуется)
   - **НЕ** выбирайте "Initialize this repository with README"
3. Нажмите **"Create repository"**

### Шаг 3: Загрузка кода на GitHub

```bash
# Проверка статуса Git
git status

# Добавление remote (ЗАМЕНИТЕ YOUR_USERNAME на ваш GitHub username)
git remote add origin git@github.com:YOUR_USERNAME/lk-housler.git

# Или через HTTPS:
# git remote add origin https://github.com/YOUR_USERNAME/lk-housler.git

# Отправка кода
git branch -M main
git push -u origin main
```

### Шаг 4: Настройка GitHub Secrets (для CI/CD)

1. Перейдите в репозиторий на GitHub
2. Settings → Secrets and variables → Actions
3. Нажмите "New repository secret"
4. Добавьте следующие секреты:

| Name | Value |
|------|-------|
| `SERVER_HOST` | `91.229.8.221` |
| `SERVER_USER` | `root` |
| `SSH_PRIVATE_KEY` | Содержимое файла `~/.ssh/id_housler` |

```bash
# Для получения содержимого SSH ключа:
cat ~/.ssh/id_housler
# Скопируйте весь вывод (включая BEGIN и END строки)
```

---

## 🖥️ Часть 2: Деплой на сервер

### Шаг 1: Подключение к серверу

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221
```

### Шаг 2: Установка необходимого ПО (если еще не установлено)

```bash
# Обновление системы
apt update && apt upgrade -y

# Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# Docker Compose
if ! command -v docker-compose &> /dev/null; then
    apt install docker-compose -y
fi

# Git
if ! command -v git &> /dev/null; then
    apt install git -y
fi

# Nginx
if ! command -v nginx &> /dev/null; then
    apt install nginx -y
fi

# Certbot для SSL
if ! command -v certbot &> /dev/null; then
    apt install certbot python3-certbot-nginx -y
fi

# Проверка установки
docker --version
docker-compose --version
git --version
nginx -v
certbot --version
```

### Шаг 3: Клонирование проекта

```bash
# Создание директории
mkdir -p /var/www
cd /var/www

# Клонирование (ЗАМЕНИТЕ YOUR_USERNAME)
git clone git@github.com:YOUR_USERNAME/lk-housler.git lk.housler.ru

# Или через HTTPS:
# git clone https://github.com/YOUR_USERNAME/lk-housler.git lk.housler.ru

cd lk.housler.ru
```

### Шаг 4: Создание .env файла

```bash
# Создание .env
nano .env
```

Вставьте следующее содержимое (используйте ключи из Шага 1):

```env
# Database
DB_NAME=lk_housler
DB_USER=lk_user
DB_PASSWORD=<ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ПАРОЛЬ>

# JWT Secret
JWT_SECRET=<ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_JWT_SECRET>

# Encryption Key
ENCRYPTION_KEY=<ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_ENCRYPTION_KEY>

# SMS.RU
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=<ВАШ_SMS_RU_API_ID>
SMS_TEST_MODE=false

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=<ВСТАВЬТЕ_СГЕНЕРИРОВАННЫЙ_MINIO_PASSWORD>

# Next.js
NEXT_PUBLIC_API_URL=https://lk.housler.ru
```

Сохраните файл:
- Нажмите `Ctrl + X`
- Нажмите `Y`
- Нажмите `Enter`

### Шаг 5: Создание необходимых директорий

```bash
# Создание директорий для логов и backup
mkdir -p logs/backend logs/nginx backups

# Установка прав
chmod -R 755 logs backups
```

### Шаг 6: Запуск приложения

```bash
# Запуск контейнеров
docker-compose -f docker-compose.prod.yml up -d --build

# Это займет 5-10 минут при первом запуске
```

### Шаг 7: Проверка запуска контейнеров

```bash
# Ожидание запуска (30 секунд)
sleep 30

# Проверка статуса
docker-compose -f docker-compose.prod.yml ps

# Все контейнеры должны быть в статусе "Up"
# Если какой-то контейнер не запустился, смотрите логи:
# docker-compose -f docker-compose.prod.yml logs <service_name>
```

### Шаг 8: Проверка работоспособности

```bash
# Проверка health endpoints
curl http://localhost:3090/health
# Ожидаемый ответ: OK

curl http://localhost:3090/api/health
# Ожидаемый ответ: {"status":"ok"}

# Проверка логов
docker-compose -f docker-compose.prod.yml logs --tail=50

# Или используйте скрипт для полной проверки
./scripts/health-check.sh
```

---

## 🌐 Часть 3: Настройка Nginx и SSL

### Шаг 1: Настройка Nginx

```bash
# Копирование конфигурации
cp /var/www/lk.housler.ru/nginx/lk.housler.ru.conf /etc/nginx/sites-available/lk.housler.ru

# Создание симлинка
ln -s /etc/nginx/sites-available/lk.housler.ru /etc/nginx/sites-enabled/lk.housler.ru

# Удаление дефолтного конфига (если есть)
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации
nginx -t

# Если все OK, перезагрузка Nginx
systemctl reload nginx

# Проверка статуса
systemctl status nginx
```

### Шаг 2: Получение SSL сертификата

```bash
# Получение сертификата Let's Encrypt
certbot --nginx -d lk.housler.ru

# Следуйте инструкциям:
# 1. Введите email для уведомлений
# 2. Согласитесь с условиями (Y)
# 3. Выберите редирект HTTP -> HTTPS: 2 (рекомендуется)
```

### Шаг 3: Проверка SSL

```bash
# Проверка сертификата
certbot certificates

# Проверка HTTPS
curl -I https://lk.housler.ru

# Должен вернуть 200 OK или 302 Redirect
```

### Шаг 4: Настройка автообновления сертификатов

```bash
# Проверка автообновления (dry run)
certbot renew --dry-run

# Если все OK, автообновление уже настроено
# Можно проверить:
systemctl list-timers | grep certbot
```

---

## 🔒 Часть 4: Настройка безопасности

### Шаг 1: Настройка Firewall (UFW)

```bash
# Установка UFW (если не установлен)
apt install ufw -y

# Разрешение SSH (ВАЖНО! Сделайте это ДО включения firewall)
ufw allow 22/tcp

# Разрешение HTTP и HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Включение firewall
ufw --force enable

# Проверка статуса
ufw status verbose
```

### Шаг 2: Настройка Fail2Ban

```bash
# Установка
apt install fail2ban -y

# Создание локальной конфигурации
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/lk.housler.ru.error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/lk.housler.ru.error.log
EOF

# Перезапуск Fail2Ban
systemctl restart fail2ban

# Проверка статуса
fail2ban-client status
```

---

## 💾 Часть 5: Настройка автоматических backup

### Шаг 1: Создание скрипта для cron

```bash
# Создание скрипта backup
cat > /root/backup-lk.sh << 'EOF'
#!/bin/bash
cd /var/www/lk.housler.ru
./scripts/backup.sh
# Удаление старых backup (старше 30 дней)
find /var/www/lk.housler.ru/backups -name "*.sql.gz" -mtime +30 -delete
find /var/www/lk.housler.ru/backups -name "*.tar.gz" -mtime +30 -delete
EOF

# Права на выполнение
chmod +x /root/backup-lk.sh

# Тестовый запуск
/root/backup-lk.sh
```

### Шаг 2: Настройка cron

```bash
# Редактирование crontab
crontab -e

# Добавьте следующие строки:
# Backup каждый день в 3:00 утра
0 3 * * * /root/backup-lk.sh >> /var/log/lk-backup.log 2>&1

# Сохраните и выйдите (Ctrl+X, Y, Enter)

# Проверка cron
crontab -l
```

---

## ✅ Часть 6: Финальная проверка

### Шаг 1: Проверка всех сервисов

```bash
cd /var/www/lk.housler.ru

# Запуск health check
./scripts/health-check.sh
```

### Шаг 2: Проверка в браузере

Откройте следующие URL в браузере:

1. **https://lk.housler.ru** - должен редиректить на /login
2. **https://lk.housler.ru/login** - страница логина
3. **https://lk.housler.ru/api/health** - должен вернуть `{"status":"ok"}`

### Шаг 3: Тестирование аутентификации

Попробуйте войти как агент:
1. Перейдите на https://lk.housler.ru/login
2. Выберите "Вход для агента"
3. Введите тестовый номер: `79999000000`
4. Введите код: `111111`

### Шаг 4: Проверка логов

```bash
# Просмотр логов всех сервисов
./scripts/logs.sh all

# Или отдельно:
./scripts/logs.sh backend
./scripts/logs.sh frontend
```

---

## 🔄 Обновление приложения (в будущем)

### Автоматическое обновление через скрипт

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221
cd /var/www/lk.housler.ru
./deploy.sh
```

### Ручное обновление

```bash
ssh -i ~/.ssh/id_housler root@91.229.8.221
cd /var/www/lk.housler.ru

# Получение изменений
git pull origin main

# Пересборка и перезапуск
docker-compose -f docker-compose.prod.yml up -d --build

# Проверка
./scripts/health-check.sh
```

---

## 📊 Мониторинг

### Полезные команды для мониторинга

```bash
# Статус контейнеров
docker-compose -f docker-compose.prod.yml ps

# Использование ресурсов
docker stats

# Логи в реальном времени
docker-compose -f docker-compose.prod.yml logs -f

# Дисковое пространство
df -h

# Использование Docker
docker system df

# Проверка портов
netstat -tulpn | grep LISTEN
```

---

## 🆘 Troubleshooting

### Проблема: Контейнеры не запускаются

```bash
# Просмотр логов
docker-compose -f docker-compose.prod.yml logs

# Пересоздание контейнеров
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### Проблема: 502 Bad Gateway

```bash
# Проверка backend
docker logs lk-backend

# Проверка nginx
nginx -t
systemctl status nginx
systemctl restart nginx
```

### Проблема: База данных недоступна

```bash
# Проверка postgres
docker logs lk-postgres

# Перезапуск
docker-compose -f docker-compose.prod.yml restart postgres
```

### Проблема: SSL сертификат не работает

```bash
# Проверка сертификата
certbot certificates

# Принудительное обновление
certbot renew --force-renewal

# Перезагрузка nginx
systemctl reload nginx
```

---

## 📞 Контакты и информация

- **Сервер**: 91.229.8.221
- **SSH**: `ssh -i ~/.ssh/id_housler root@91.229.8.221`
- **Домен**: https://lk.housler.ru
- **GitHub**: https://github.com/YOUR_USERNAME/lk-housler

---

## ✅ Чеклист деплоя

Отметьте выполненные шаги:

### Локально
- [ ] Сгенерированы секретные ключи
- [ ] Создан репозиторий на GitHub
- [ ] Код загружен на GitHub
- [ ] Настроены GitHub Secrets

### На сервере
- [ ] Установлены Docker, Docker Compose, Git, Nginx, Certbot
- [ ] Проект склонирован в /var/www/lk.housler.ru
- [ ] Создан .env файл с секретными ключами
- [ ] Запущены Docker контейнеры
- [ ] Все контейнеры работают (health check)
- [ ] Настроен Nginx
- [ ] Получен SSL сертификат
- [ ] Настроен Firewall (UFW)
- [ ] Настроен Fail2Ban
- [ ] Настроены автоматические backup

### Проверка
- [ ] https://lk.housler.ru открывается
- [ ] https://lk.housler.ru/api/health возвращает OK
- [ ] Аутентификация работает
- [ ] Логи не содержат критических ошибок

---

**🎉 Поздравляем! Деплой завершен!**

Ваше приложение работает на **https://lk.housler.ru**

