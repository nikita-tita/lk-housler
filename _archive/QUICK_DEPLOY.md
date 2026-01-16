# ⚡ Быстрый деплой lk.housler.ru

Краткая инструкция для быстрого развертывания проекта.

---

## 📋 Предварительные требования

- SSH доступ к серверу: `ssh -i ~/.ssh/id_housler root@91.229.8.221`
- Docker и Docker Compose на сервере
- GitHub аккаунт

---

## 🚀 Шаг 1: Загрузка на GitHub (локально)

```bash
# 1. Инициализация Git
cd /Users/fatbookpro/Desktop/lk
git init
git add .
git commit -m "Initial commit: Backend + Frontend complete"

# 2. Создайте репозиторий на GitHub (https://github.com/new)
# Название: lk-housler
# Тип: Private

# 3. Подключение к GitHub (замените YOUR_USERNAME)
git remote add origin git@github.com/YOUR_USERNAME/lk-housler.git
git branch -M main
git push -u origin main
```

---

## 🖥️ Шаг 2: Деплой на сервер

```bash
# 1. Подключение к серверу
ssh -i ~/.ssh/id_housler root@91.229.8.221

# 2. Клонирование проекта
cd /var/www
git clone git@github.com/YOUR_USERNAME/lk-housler.git lk.housler.ru
cd lk.housler.ru

# 3. Создание .env файла
nano .env
```

Вставьте (замените значения на реальные):

```env
# Database
DB_NAME=lk_housler
DB_USER=lk_user
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# JWT Secret (генерация: openssl rand -base64 32)
JWT_SECRET=YOUR_JWT_SECRET_HERE

# Encryption Key (генерация: openssl rand -hex 32)
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE

# SMS.RU
SMS_PROVIDER=sms_ru
SMS_RU_API_ID=YOUR_SMS_RU_API_ID
SMS_TEST_MODE=false

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=YOUR_MINIO_PASSWORD

# Next.js
NEXT_PUBLIC_API_URL=https://lk.housler.ru
```

```bash
# 4. Создание директорий
mkdir -p logs/backend logs/nginx backups

# 5. Запуск приложения
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Проверка (ждем 30 секунд)
sleep 30
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:3090/health
```

---

## 🌐 Шаг 3: Настройка Nginx

```bash
# 1. Копирование конфига
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/lk.housler.ru
ln -s /etc/nginx/sites-available/lk.housler.ru /etc/nginx/sites-enabled/

# 2. Проверка и перезагрузка
nginx -t
systemctl reload nginx

# 3. SSL сертификат
certbot --nginx -d lk.housler.ru

# 4. Проверка
curl -I https://lk.housler.ru
```

---

## ✅ Шаг 4: Проверка

Откройте в браузере:
- https://lk.housler.ru
- https://lk.housler.ru/login
- https://lk.housler.ru/api/health

---

## 🔄 Обновление приложения

```bash
# На сервере
cd /var/www/lk.housler.ru
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

Или используйте скрипт:

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 Полезные команды

```bash
# Логи
docker-compose -f docker-compose.prod.yml logs -f

# Статус
docker-compose -f docker-compose.prod.yml ps

# Перезапуск
docker-compose -f docker-compose.prod.yml restart

# Backup БД
docker exec lk-postgres pg_dump -U lk_user lk_housler | gzip > backup_$(date +%Y%m%d).sql.gz
```

---

## 🆘 Troubleshooting

### Контейнеры не запускаются
```bash
docker-compose -f docker-compose.prod.yml logs
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build
```

### 502 Bad Gateway
```bash
docker logs lk-backend
docker logs lk-nginx
systemctl restart nginx
```

### База данных недоступна
```bash
docker logs lk-postgres
docker-compose -f docker-compose.prod.yml restart postgres
```

---

## 📚 Полная документация

Смотрите [DEPLOYMENT.md](./DEPLOYMENT.md) для подробной инструкции.

---

**Готово! Приложение работает на https://lk.housler.ru** 🎉

