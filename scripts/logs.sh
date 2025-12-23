#!/bin/bash

# Скрипт для просмотра логов
# Использование: ./scripts/logs.sh [service]

SERVICE=${1:-all}

case $SERVICE in
    backend)
        echo "📜 Логи Backend..."
        docker-compose -f docker-compose.prod.yml logs -f backend
        ;;
    frontend)
        echo "📜 Логи Frontend..."
        docker-compose -f docker-compose.prod.yml logs -f frontend
        ;;
    postgres)
        echo "📜 Логи PostgreSQL..."
        docker-compose -f docker-compose.prod.yml logs -f postgres
        ;;
    redis)
        echo "📜 Логи Redis..."
        docker-compose -f docker-compose.prod.yml logs -f redis
        ;;
    minio)
        echo "📜 Логи MinIO..."
        docker-compose -f docker-compose.prod.yml logs -f minio
        ;;
    nginx)
        echo "📜 Логи Nginx..."
        docker-compose -f docker-compose.prod.yml logs -f nginx
        ;;
    all)
        echo "📜 Логи всех сервисов..."
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    *)
        echo "❌ Неизвестный сервис: $SERVICE"
        echo ""
        echo "Доступные сервисы:"
        echo "  - backend"
        echo "  - frontend"
        echo "  - postgres"
        echo "  - redis"
        echo "  - minio"
        echo "  - nginx"
        echo "  - all (по умолчанию)"
        echo ""
        echo "Использование: ./scripts/logs.sh [service]"
        exit 1
        ;;
esac

