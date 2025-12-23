#!/bin/bash

# Скрипт для автоматического деплоя lk.housler.ru
# Использование: ./deploy.sh

set -e

echo "🚀 Начинаем деплой lk.housler.ru..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода ошибок
error() {
    echo -e "${RED}❌ Ошибка: $1${NC}"
    exit 1
}

# Функция для вывода успеха
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Функция для вывода предупреждений
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Проверка наличия необходимых команд
check_requirements() {
    echo "📋 Проверка требований..."
    
    command -v git >/dev/null 2>&1 || error "Git не установлен"
    command -v docker >/dev/null 2>&1 || error "Docker не установлен"
    command -v docker-compose >/dev/null 2>&1 || error "Docker Compose не установлен"
    
    success "Все требования выполнены"
}

# Проверка .env файла
check_env() {
    echo "🔍 Проверка .env файла..."
    
    if [ ! -f .env ]; then
        error ".env файл не найден. Создайте его на основе .env.example"
    fi
    
    # Проверка обязательных переменных
    required_vars=("DB_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY" "SMS_RU_API_ID")
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            error "Переменная ${var} не найдена в .env файле"
        fi
    done
    
    success ".env файл корректен"
}

# Получение последних изменений из Git
update_code() {
    echo "📥 Получение последних изменений..."
    
    if [ -d .git ]; then
        git pull origin main || warning "Не удалось обновить код из Git"
        success "Код обновлен"
    else
        warning "Git репозиторий не инициализирован"
    fi
}

# Остановка старых контейнеров
stop_containers() {
    echo "🛑 Остановка старых контейнеров..."
    
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        docker-compose -f docker-compose.prod.yml down
        success "Контейнеры остановлены"
    else
        warning "Контейнеры уже остановлены"
    fi
}

# Создание backup базы данных
backup_database() {
    echo "💾 Создание backup базы данных..."
    
    if docker ps | grep -q lk-postgres; then
        BACKUP_DIR="./backups"
        mkdir -p $BACKUP_DIR
        
        BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
        
        docker exec lk-postgres pg_dump -U lk_user lk_housler | gzip > $BACKUP_FILE
        
        if [ -f $BACKUP_FILE ]; then
            success "Backup создан: $BACKUP_FILE"
        else
            warning "Не удалось создать backup"
        fi
    else
        warning "PostgreSQL контейнер не запущен, backup пропущен"
    fi
}

# Сборка и запуск контейнеров
build_and_start() {
    echo "🔨 Сборка и запуск контейнеров..."
    
    docker-compose -f docker-compose.prod.yml up -d --build
    
    success "Контейнеры запущены"
}

# Проверка здоровья контейнеров
check_health() {
    echo "🏥 Проверка здоровья контейнеров..."
    
    # Ждем 30 секунд для запуска
    echo "⏳ Ожидание запуска контейнеров (30 сек)..."
    sleep 30
    
    # Проверка каждого контейнера
    containers=("lk-postgres" "lk-redis" "lk-minio" "lk-backend" "lk-frontend" "lk-nginx")
    
    for container in "${containers[@]}"; do
        if docker ps | grep -q $container; then
            success "$container работает"
        else
            error "$container не запущен"
        fi
    done
    
    # Проверка health endpoint
    echo "🔍 Проверка API..."
    sleep 10
    
    if curl -f http://localhost:3090/health > /dev/null 2>&1; then
        success "API отвечает"
    else
        warning "API не отвечает, проверьте логи"
    fi
}

# Просмотр логов
show_logs() {
    echo "📜 Последние логи:"
    docker-compose -f docker-compose.prod.yml logs --tail=50
}

# Вывод информации о деплое
show_info() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    success "Деплой завершен успешно!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Статус контейнеров:"
    docker-compose -f docker-compose.prod.yml ps
    echo ""
    echo "🌐 Приложение доступно по адресу:"
    echo "   http://localhost:3090"
    echo "   https://lk.housler.ru (если настроен SSL)"
    echo ""
    echo "📝 Полезные команды:"
    echo "   Логи:           docker-compose -f docker-compose.prod.yml logs -f"
    echo "   Перезапуск:     docker-compose -f docker-compose.prod.yml restart"
    echo "   Остановка:      docker-compose -f docker-compose.prod.yml stop"
    echo "   Статус:         docker-compose -f docker-compose.prod.yml ps"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Основная функция
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🚀 Деплой lk.housler.ru"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    check_requirements
    check_env
    
    # Спросить про backup
    if docker ps | grep -q lk-postgres; then
        read -p "Создать backup базы данных? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            backup_database
        fi
    fi
    
    update_code
    stop_containers
    build_and_start
    check_health
    show_info
    
    # Спросить про логи
    read -p "Показать логи? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        show_logs
    fi
}

# Запуск
main
