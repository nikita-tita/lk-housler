#!/bin/bash

# Скрипт для создания backup базы данных и MinIO
# Использование: ./scripts/backup.sh

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Создание backup lk.housler.ru..."
echo "===================================="

# Создание директории для backup
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
if docker ps | grep -q lk-postgres; then
    echo "📦 Backup PostgreSQL..."
    docker exec lk-postgres pg_dump -U lk_user lk_housler | gzip > "${BACKUP_DIR}/postgres_${DATE}.sql.gz"
    echo "✅ PostgreSQL backup: ${BACKUP_DIR}/postgres_${DATE}.sql.gz"
else
    echo "⚠️  PostgreSQL контейнер не запущен"
fi

# Backup MinIO
if docker ps | grep -q lk-minio; then
    echo "📦 Backup MinIO..."
    docker run --rm \
        -v lk_minio_data:/data \
        -v $(pwd)/${BACKUP_DIR}:/backup \
        alpine tar czf /backup/minio_${DATE}.tar.gz /data
    echo "✅ MinIO backup: ${BACKUP_DIR}/minio_${DATE}.tar.gz"
else
    echo "⚠️  MinIO контейнер не запущен"
fi

# Информация о размере backup
echo ""
echo "📊 Размер backup:"
du -sh ${BACKUP_DIR}/*${DATE}*

echo ""
echo "✅ Backup завершен!"
echo ""
echo "📝 Восстановление:"
echo "   PostgreSQL: gunzip < ${BACKUP_DIR}/postgres_${DATE}.sql.gz | docker exec -i lk-postgres psql -U lk_user lk_housler"
echo "   MinIO:      docker run --rm -v lk_minio_data:/data -v \$(pwd)/${BACKUP_DIR}:/backup alpine tar xzf /backup/minio_${DATE}.tar.gz -C /"
echo ""

