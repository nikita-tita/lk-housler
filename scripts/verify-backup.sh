#!/bin/bash

# ===========================================
# Верификация backup
# ===========================================
# Проверяет целостность последнего backup

set -e

BACKUP_DIR="/var/www/lk.housler.ru/backups"
LOG_FILE="/var/www/lk.housler.ru/logs/backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] VERIFY: $1" >> "$LOG_FILE"
}

# Проверка последнего PostgreSQL backup
latest_pg=$(ls -t "${BACKUP_DIR}"/postgres_prod_*.sql.gz 2>/dev/null | head -1)
if [ -n "$latest_pg" ]; then
    # Проверка gzip целостности
    if gzip -t "$latest_pg" 2>/dev/null; then
        # Проверка содержимого SQL
        if gunzip -c "$latest_pg" | head -100 | grep -q "PostgreSQL database dump"; then
            size=$(du -h "$latest_pg" | cut -f1)
            log "PostgreSQL backup OK: $latest_pg ($size)"
        else
            log "ERROR: PostgreSQL backup corrupted - invalid SQL content"
            exit 1
        fi
    else
        log "ERROR: PostgreSQL backup corrupted - gzip integrity failed"
        exit 1
    fi
else
    log "WARNING: No PostgreSQL backup found"
fi

# Проверка последнего MinIO backup
latest_minio=$(ls -t "${BACKUP_DIR}"/minio_*.tar.gz 2>/dev/null | head -1)
if [ -n "$latest_minio" ]; then
    if gzip -t "$latest_minio" 2>/dev/null; then
        size=$(du -h "$latest_minio" | cut -f1)
        log "MinIO backup OK: $latest_minio ($size)"
    else
        log "ERROR: MinIO backup corrupted - gzip integrity failed"
        exit 1
    fi
fi

# Проверка последнего Redis backup
latest_redis=$(ls -t "${BACKUP_DIR}"/redis_*.rdb.gz 2>/dev/null | head -1)
if [ -n "$latest_redis" ]; then
    if gzip -t "$latest_redis" 2>/dev/null; then
        size=$(du -h "$latest_redis" | cut -f1)
        log "Redis backup OK: $latest_redis ($size)"
    else
        log "ERROR: Redis backup corrupted"
        exit 1
    fi
fi

log "All backup verifications passed"
