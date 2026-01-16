# 🚀 НАЧНИТЕ ЗДЕСЬ - Деплой lk.housler.ru

## ✅ Проект готов к деплою!

Весь код написан, все скрипты готовы, вся документация создана.

---

## 📋 Что нужно сделать (3 простых шага)

### Шаг 1: Загрузить код на GitHub (5 минут)

1. Создайте репозиторий на GitHub:
   - Перейдите на https://github.com/new
   - Название: `lk-housler`
   - Тип: **Private**
   - Нажмите "Create repository"

2. Загрузите код:
   ```bash
   # ЗАМЕНИТЕ YOUR_USERNAME на ваш GitHub username
   git remote add origin git@github.com:YOUR_USERNAME/lk-housler.git
   git push -u origin main
   ```

### Шаг 2: Деплой на сервер (30 минут)

Откройте файл **[DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md)** и следуйте инструкциям.

Или используйте быстрые команды:

```bash
# Подключение к серверу
ssh -i ~/.ssh/id_housler root@91.229.8.221

# Клонирование
cd /var/www
git clone git@github.com:YOUR_USERNAME/lk-housler.git lk.housler.ru
cd lk.housler.ru

# Генерация ключей
./scripts/generate-keys.sh

# Создание .env (скопируйте сгенерированные ключи)
nano .env

# Запуск
docker-compose -f docker-compose.prod.yml up -d --build

# Настройка Nginx
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/lk.housler.ru
ln -s /etc/nginx/sites-available/lk.housler.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL сертификат
certbot --nginx -d lk.housler.ru
```

### Шаг 3: Проверка (5 минут)

```bash
# На сервере
./scripts/health-check.sh

# В браузере
# Откройте: https://lk.housler.ru
```

---

## 📚 Документация

### Главные документы для деплоя:

1. **[DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md)** ⭐⭐⭐
   - **НАЧНИТЕ С ЭТОГО**
   - Пошаговая инструкция со всеми командами
   - Копируйте и вставляйте команды по порядку

2. **[READY_TO_DEPLOY.md](./READY_TO_DEPLOY.md)** ⭐⭐
   - Краткое резюме проекта
   - Чеклист перед деплоем

3. **[QUICK_DEPLOY.md](./QUICK_DEPLOY.md)** ⭐
   - Для опытных пользователей
   - Только команды без объяснений

4. **[DEPLOYMENT.md](./DEPLOYMENT.md)**
   - Полная документация
   - Troubleshooting
   - Мониторинг и обслуживание

---

## 🎯 Что уже готово

✅ **Backend** - FastAPI, PostgreSQL, Redis, MinIO  
✅ **Frontend** - Next.js 16, Tailwind CSS v4  
✅ **Аутентификация** - SMS, Email, Email+Password  
✅ **Безопасность** - PII шифрование, JWT, HTTPS  
✅ **Docker** - Development и Production конфиги  
✅ **Nginx** - Reverse proxy конфигурация  
✅ **Скрипты** - Deploy, backup, restore, health-check  
✅ **Документация** - 30+ документов  
✅ **Git** - Инициализирован, 3 коммита готовы  

---

## ⚡ Быстрый старт (для опытных)

```bash
# 1. GitHub (локально)
git remote add origin git@github.com:YOUR_USERNAME/lk-housler.git
git push -u origin main

# 2. Сервер
ssh -i ~/.ssh/id_housler root@91.229.8.221
cd /var/www && git clone git@github.com:YOUR_USERNAME/lk-housler.git lk.housler.ru
cd lk.housler.ru

# 3. Настройка
./scripts/generate-keys.sh > keys.txt
nano .env  # Вставьте ключи из keys.txt

# 4. Запуск
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Nginx + SSL
cp nginx/lk.housler.ru.conf /etc/nginx/sites-available/lk.housler.ru
ln -s /etc/nginx/sites-available/lk.housler.ru /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d lk.housler.ru

# 6. Готово!
./scripts/health-check.sh
```

---

## 📞 Важная информация

- **Сервер**: 91.229.8.221
- **SSH**: `ssh -i ~/.ssh/id_housler root@91.229.8.221`
- **Домен**: https://lk.housler.ru
- **Время деплоя**: ~45-60 минут

---

## 🎉 Следующий шаг

**Откройте [DEPLOY_INSTRUCTIONS.md](./DEPLOY_INSTRUCTIONS.md) и начните деплой!**

---

Удачи! 🚀

