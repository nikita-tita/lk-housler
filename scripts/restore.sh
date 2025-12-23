#!/bin/bash

# Скрипт для восстановления backup
# Использование: ./scripts/restore.sh <backup_file>

set -e

if [ -z "$1" ]; then
    echo "❌ Ошибка: укажите файл backup"
    echo "Использование: ./scripts/restore.sh <backup_file>"
    echo ""
    echo "Доступные backup:"
    ls -lh backups/
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Ошибка: файл $BACKUP_FILE не найден"
    exit 1
fi

echo "⚠️  ВНИМАНИЕ: Восстановление backup удалит текущие данные!"
read -p "Продолжить? (yes/no) " -r
echo

if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "❌ Отменено"
    exit 0
fi

# Определение типа backup
if [[ $BACKUP_FILE == *"postgres"* ]]; then
    echo "📦 Восстановление PostgreSQL..."
    
    if ! docker ps | grep -q lk-postgres; then
        echo "❌ PostgreSQL контейнер не запущен"
        exit 1
    fi
    
    gunzip < $BACKUP_FILE | docker exec -i lk-postgres psql -U lk_user lk_housler
    echo "✅ PostgreSQL восстановлен"
    
elif [[ $BACKUP_FILE == *"minio"* ]]; then
    echo "📦 Восстановление MinIO..."
    
    if ! docker ps | grep -q lk-minio; then
        echo "❌ MinIO контейнер не запущен"
        exit 1
    fi
    
    docker run --rm \
        -v lk_minio_data:/data \
        -v $(pwd)/$(dirname $BACKUP_FILE):/backup \
        alpine tar xzf /backup/$(basename $BACKUP_FILE) -C /
    
    echo "✅ MinIO восстановлен"
    
else
    echo "❌ Неизвестный тип backup"
    exit 1
fi

echo ""
echo "✅ Восстановление завершено!"
echo ""

