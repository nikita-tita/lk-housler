#!/bin/bash
# Скрипт быстрого запуска проекта lk.housler.ru

set -e  # Остановка при ошибке

echo "🚀 Запуск Agent Deal Platform (lk.housler.ru)"
echo ""

# Проверка Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker не запущен. Запустите Docker Desktop и попробуйте снова."
    exit 1
fi

echo "✅ Docker работает"
echo ""

# Проверка .env
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Файл backend/.env не найден"
    echo "📝 Копирую .env.example -> backend/.env"
    cp .env.example backend/.env
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте backend/.env и установите:"
    echo "   - ENCRYPTION_KEY (64 hex символа)"
    echo "   - SMS_RU_API_ID (ваш API ID от SMS.RU)"
    echo ""
    echo "Нажмите Enter после настройки .env..."
    read
fi

echo "✅ backend/.env найден"
echo ""

# Запуск Docker Compose
echo "🐳 Запуск PostgreSQL, Redis, MinIO..."
docker-compose up -d

# Ожидание запуска БД
echo "⏳ Ожидание запуска PostgreSQL (10 секунд)..."
sleep 10

echo "✅ Инфраструктура запущена"
echo ""

# Установка зависимостей Python
echo "📦 Установка зависимостей Python..."
cd backend

if [ ! -d "venv" ]; then
    echo "   Создание виртуального окружения..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "   Установка пакетов..."
pip install -q -r requirements.txt

echo "✅ Зависимости установлены"
echo ""

# Создание миграций
echo "🗄️  Применение миграций БД..."

# Проверка наличия миграций
if [ ! -d "alembic/versions" ] || [ -z "$(ls -A alembic/versions 2>/dev/null)" ]; then
    echo "   Создание первой миграции..."
    alembic revision --autogenerate -m "Initial migration with all models"
fi

echo "   Применение миграций..."
alembic upgrade head

echo "✅ База данных готова"
echo ""

# Запуск Backend
echo "🚀 Запуск FastAPI Backend..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Backend запущен!"
echo ""
echo "📍 URLs:"
echo "   - API: http://localhost:8000"
echo "   - Swagger UI: http://localhost:8000/docs"
echo "   - ReDoc: http://localhost:8000/redoc"
echo ""
echo "🧪 Тестирование:"
echo "   curl -X POST http://localhost:8000/api/v1/auth/agent/sms/send \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"phone\": \"+79999123456\"}'"
echo ""
echo "Остановка: Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Запуск сервера
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

