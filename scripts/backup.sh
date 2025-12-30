#!/bin/bash

# ===========================================
# Автоматический backup базы данных и MinIO
# ===========================================
# Использование:
#   ./scripts/backup.sh              - интерактивный режим
#   ./scripts/backup.sh --auto       - автоматический режим (для cron)
#   ./scripts/backup.sh --production - принудительно production
#   ./scripts/backup.sh --dev        - принудительно development

set -e

# Конфигурация
BACKUP_DIR="/var/www/lk.housler.ru/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14
LOG_FILE="/var/www/lk.housler.ru/logs/backup.log"

# Определение режима работы
AUTO_MODE=false
FORCE_ENV=""

for arg in "$@"; do
    case $arg in
        --auto)
            AUTO_MODE=true
            ;;
        --production)
            FORCE_ENV="production"
            ;;
        --dev)
            FORCE_ENV="development"
            ;;
    esac
done

# Функция логирования
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    if [ "$AUTO_MODE" = true ]; then
        echo "$message" >> "$LOG_FILE"
    else
        echo "$message"
    fi
}

# Функция для определения окружения
detect_environment() {
    if [ -n "$FORCE_ENV" ]; then
        echo "$FORCE_ENV"
        return
    fi

    # Проверяем наличие agent-postgres контейнера (production)
    if docker ps 2>/dev/null | grep -q "agent-postgres"; then
        echo "production"
    # Проверяем наличие lk_postgres контейнера (development)
    elif docker ps 2>/dev/null | grep -q "lk_postgres"; then
        echo "development"
    else
        echo "unknown"
    fi
}

# Функция для backup PostgreSQL
backup_postgres() {
    local env=$1

    if [ "$env" = "production" ]; then
        # Production: agent-postgres из housler_pervichka
        local container="agent-postgres"
        local db_user="housler"
        local db_name="housler_agent"
        local backup_file="${BACKUP_DIR}/postgres_prod_${DATE}.sql.gz"
    else
        # Development: локальный lk_postgres
        local container="lk_postgres"
        local db_user="lk_user"
        local db_name="lk_db"
        local backup_file="${BACKUP_DIR}/postgres_dev_${DATE}.sql.gz"
    fi

    if docker ps | grep -q "$container"; then
        log "Backup PostgreSQL ($env)..."
        docker exec "$container" pg_dump -U "$db_user" "$db_name" 2>/dev/null | gzip > "$backup_file"

        if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
            local size=$(du -h "$backup_file" | cut -f1)
            log "PostgreSQL backup: $backup_file ($size)"
            return 0
        else
            log "ERROR: PostgreSQL backup failed - empty file"
            rm -f "$backup_file"
            return 1
        fi
    else
        log "WARNING: PostgreSQL container '$container' not running"
        return 1
    fi
}

# Функция для backup MinIO
backup_minio() {
    local container="lk-minio"
    local volume="lk_minio_data"
    local backup_file="${BACKUP_DIR}/minio_${DATE}.tar.gz"

    if docker ps | grep -q "$container"; then
        log "Backup MinIO..."
        docker run --rm \
            -v "${volume}:/data:ro" \
            -v "${BACKUP_DIR}:/backup" \
            alpine tar czf "/backup/minio_${DATE}.tar.gz" /data 2>/dev/null

        if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
            local size=$(du -h "$backup_file" | cut -f1)
            log "MinIO backup: $backup_file ($size)"
            return 0
        else
            log "ERROR: MinIO backup failed"
            rm -f "$backup_file"
            return 1
        fi
    else
        log "WARNING: MinIO container not running"
        return 1
    fi
}

# Функция для backup Redis
backup_redis() {
    local container="lk-redis"
    local backup_file="${BACKUP_DIR}/redis_${DATE}.rdb"

    if docker ps | grep -q "$container"; then
        log "Backup Redis..."
        # Триггер BGSAVE и копирование dump
        docker exec "$container" redis-cli BGSAVE >/dev/null 2>&1
        sleep 2
        docker cp "${container}:/data/dump.rdb" "$backup_file" 2>/dev/null || true

        if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
            gzip "$backup_file"
            local size=$(du -h "${backup_file}.gz" | cut -f1)
            log "Redis backup: ${backup_file}.gz ($size)"
            return 0
        else
            log "WARNING: Redis backup skipped (no data or failed)"
            rm -f "$backup_file"
            return 1
        fi
    else
        log "WARNING: Redis container not running"
        return 1
    fi
}

# Функция для ротации старых backup
cleanup_old_backups() {
    log "Cleanup: removing backups older than $RETENTION_DAYS days..."

    local count=$(find "$BACKUP_DIR" -name "*.gz" -o -name "*.sql" | wc -l | tr -d ' ')
    local deleted=$(find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l | tr -d ' ')

    if [ "$deleted" -gt 0 ]; then
        log "Deleted $deleted old backup files"
    fi

    # Оставляем минимум 3 последних backup каждого типа
    for prefix in postgres_prod postgres_dev minio redis; do
        local files=$(ls -t "${BACKUP_DIR}/${prefix}"* 2>/dev/null | tail -n +4)
        if [ -n "$files" ]; then
            echo "$files" | xargs rm -f 2>/dev/null || true
        fi
    done
}

# Функция для вывода статистики
show_stats() {
    log ""
    log "Backup statistics:"
    log "-------------------"

    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    local total_files=$(find "$BACKUP_DIR" -type f \( -name "*.gz" -o -name "*.sql" \) 2>/dev/null | wc -l | tr -d ' ')

    log "Total size: $total_size"
    log "Total files: $total_files"
    log ""

    if [ "$AUTO_MODE" = false ]; then
        log "Latest backups:"
        ls -lhtr "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No backups found"
    fi
}

# ===========================================
# MAIN
# ===========================================

# Создание директорий
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log "========================================"
log "lk.housler.ru Backup Started"
log "========================================"

# Определение окружения
ENV=$(detect_environment)
log "Environment: $ENV"

if [ "$ENV" = "unknown" ]; then
    log "ERROR: No database containers found"
    exit 1
fi

# Выполнение backup
POSTGRES_OK=false
MINIO_OK=false
REDIS_OK=false

if backup_postgres "$ENV"; then
    POSTGRES_OK=true
fi

if backup_minio; then
    MINIO_OK=true
fi

if backup_redis; then
    REDIS_OK=true
fi

# Очистка старых backup
cleanup_old_backups

# Статистика
show_stats

log "========================================"
if [ "$POSTGRES_OK" = true ]; then
    log "Backup completed successfully"
    exit 0
else
    log "Backup completed with warnings"
    exit 1
fi
