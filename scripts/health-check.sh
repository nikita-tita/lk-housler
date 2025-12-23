#!/bin/bash

# Скрипт для проверки здоровья всех сервисов
# Использование: ./scripts/health-check.sh

echo "🏥 Проверка здоровья lk.housler.ru"
echo "=================================="
echo ""

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_container() {
    local container=$1
    local name=$2
    
    if docker ps | grep -q $container; then
        echo -e "${GREEN}✅ $name работает${NC}"
        return 0
    else
        echo -e "${RED}❌ $name не работает${NC}"
        return 1
    fi
}

check_url() {
    local url=$1
    local name=$2
    
    if curl -f -s $url > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name доступен${NC}"
        return 0
    else
        echo -e "${RED}❌ $name недоступен${NC}"
        return 1
    fi
}

# Проверка контейнеров
echo "📦 Контейнеры:"
check_container "lk-postgres" "PostgreSQL"
check_container "lk-redis" "Redis"
check_container "lk-minio" "MinIO"
check_container "lk-backend" "Backend"
check_container "lk-frontend" "Frontend"
check_container "lk-nginx" "Nginx"

echo ""

# Проверка endpoints
echo "🌐 Endpoints:"
check_url "http://localhost:3090/health" "Nginx Health"
check_url "http://localhost:3090/api/health" "Backend API"

echo ""

# Проверка ресурсов
echo "💻 Ресурсы:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""

# Проверка дискового пространства
echo "💾 Дисковое пространство:"
df -h | grep -E "Filesystem|/var/lib/docker|/$"

echo ""

# Проверка портов
echo "🔌 Порты:"
netstat -tlnp 2>/dev/null | grep -E "3090|5432|6379|9000" || ss -tlnp | grep -E "3090|5432|6379|9000"

echo ""
echo "=================================="
echo "✅ Проверка завершена"

