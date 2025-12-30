#!/bin/bash

# ===========================================
# Восстановление backup
# ===========================================
# Использование:
#   ./scripts/restore.sh                     - интерактивный выбор
#   ./scripts/restore.sh <backup_file>       - восстановить конкретный файл
#   ./scripts/restore.sh --latest            - восстановить последний backup
#   ./scripts/restore.sh --latest --force    - без подтверждения

set -e

BACKUP_DIR="/var/www/lk.housler.ru/backups"
FORCE_MODE=false
LATEST_MODE=false
BACKUP_FILE=""

# Парсинг аргументов
for arg in "$@"; do
    case $arg in
        --force)
            FORCE_MODE=true
            ;;
        --latest)
            LATEST_MODE=true
            ;;
        *)
            if [ -z "$BACKUP_FILE" ] && [ -f "$arg" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Функция для определения окружения
detect_environment() {
    if docker ps 2>/dev/null | grep -q "agent-postgres"; then
        echo "production"
    elif docker ps 2>/dev/null | grep -q "lk_postgres"; then
        echo "development"
    else
        echo "unknown"
    fi
}

# Функция для показа доступных backup
list_backups() {
    echo "Available backups:"
    echo "==================="
    echo ""
    echo "PostgreSQL:"
    ls -lhtr "${BACKUP_DIR}"/postgres_*.sql.gz 2>/dev/null || echo "  No PostgreSQL backups"
    echo ""
    echo "MinIO:"
    ls -lhtr "${BACKUP_DIR}"/minio_*.tar.gz 2>/dev/null || echo "  No MinIO backups"
    echo ""
    echo "Redis:"
    ls -lhtr "${BACKUP_DIR}"/redis_*.rdb.gz 2>/dev/null || echo "  No Redis backups"
    echo ""
}

# Функция для подтверждения
confirm() {
    if [ "$FORCE_MODE" = true ]; then
        return 0
    fi

    echo ""
    echo "WARNING: This will overwrite current data!"
    read -p "Continue? (yes/no) " -r
    echo

    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Cancelled"
        exit 0
    fi
}

# Функция восстановления PostgreSQL
restore_postgres() {
    local file=$1
    local env=$(detect_environment)

    if [ "$env" = "production" ]; then
        local container="agent-postgres"
        local db_user="housler"
        local db_name="housler_agent"
    else
        local container="lk_postgres"
        local db_user="lk_user"
        local db_name="lk_db"
    fi

    if ! docker ps | grep -q "$container"; then
        echo "ERROR: PostgreSQL container '$container' not running"
        exit 1
    fi

    echo "Restoring PostgreSQL from: $file"
    echo "Target: $container / $db_name"
    confirm

    # Очистка и восстановление
    echo "Dropping existing data..."
    docker exec "$container" psql -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS ${db_name}_restore;" 2>/dev/null || true
    docker exec "$container" psql -U "$db_user" -d postgres -c "CREATE DATABASE ${db_name}_restore;" 2>/dev/null

    echo "Restoring data..."
    gunzip -c "$file" | docker exec -i "$container" psql -U "$db_user" "${db_name}_restore"

    # Swap databases
    echo "Swapping databases..."
    docker exec "$container" psql -U "$db_user" -d postgres -c "
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}';
    " 2>/dev/null || true

    docker exec "$container" psql -U "$db_user" -d postgres -c "
        DROP DATABASE IF EXISTS ${db_name}_old;
        ALTER DATABASE ${db_name} RENAME TO ${db_name}_old;
        ALTER DATABASE ${db_name}_restore RENAME TO ${db_name};
    " 2>/dev/null

    echo "PostgreSQL restored successfully"
    echo "Old database saved as: ${db_name}_old (drop manually if not needed)"
}

# Функция восстановления MinIO
restore_minio() {
    local file=$1
    local container="lk-minio"
    local volume="lk_minio_data"

    if ! docker ps | grep -q "$container"; then
        echo "ERROR: MinIO container not running"
        exit 1
    fi

    echo "Restoring MinIO from: $file"
    confirm

    # Остановка MinIO
    echo "Stopping MinIO..."
    docker stop "$container"

    # Восстановление
    echo "Restoring data..."
    docker run --rm \
        -v "${volume}:/data" \
        -v "$(dirname "$file"):/backup" \
        alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$file") -C /"

    # Запуск MinIO
    echo "Starting MinIO..."
    docker start "$container"

    echo "MinIO restored successfully"
}

# Функция восстановления Redis
restore_redis() {
    local file=$1
    local container="lk-redis"

    if ! docker ps | grep -q "$container"; then
        echo "ERROR: Redis container not running"
        exit 1
    fi

    echo "Restoring Redis from: $file"
    confirm

    # Распаковка во временный файл
    local temp_file="/tmp/dump.rdb"
    gunzip -c "$file" > "$temp_file"

    # Остановка Redis, копирование, запуск
    echo "Stopping Redis..."
    docker stop "$container"
    docker cp "$temp_file" "${container}:/data/dump.rdb"
    echo "Starting Redis..."
    docker start "$container"

    rm -f "$temp_file"
    echo "Redis restored successfully"
}

# ===========================================
# MAIN
# ===========================================

echo "lk.housler.ru Backup Restore"
echo "============================="
echo ""

ENV=$(detect_environment)
echo "Environment: $ENV"
echo ""

# Если --latest, найти последний backup
if [ "$LATEST_MODE" = true ] && [ -z "$BACKUP_FILE" ]; then
    BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/postgres_*.sql.gz 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        echo "ERROR: No backups found"
        exit 1
    fi
    echo "Latest backup: $BACKUP_FILE"
fi

# Если файл не указан, показать список
if [ -z "$BACKUP_FILE" ]; then
    list_backups
    echo ""
    echo "Usage: ./scripts/restore.sh <backup_file>"
    echo "       ./scripts/restore.sh --latest"
    exit 0
fi

# Проверка существования файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: File not found: $BACKUP_FILE"
    exit 1
fi

# Определение типа backup и восстановление
if [[ "$BACKUP_FILE" == *"postgres"* ]]; then
    restore_postgres "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *"minio"* ]]; then
    restore_minio "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *"redis"* ]]; then
    restore_redis "$BACKUP_FILE"
else
    echo "ERROR: Unknown backup type"
    exit 1
fi

echo ""
echo "Restore completed!"
echo ""
