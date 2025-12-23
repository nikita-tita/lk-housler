#!/bin/bash

# Скрипт для генерации секретных ключей для .env файла
# Использование: ./scripts/generate-keys.sh

echo "🔐 Генерация секретных ключей для lk.housler.ru"
echo "================================================"
echo ""

echo "📝 Скопируйте эти значения в ваш .env файл:"
echo ""

echo "# Database Password"
echo "DB_PASSWORD=$(openssl rand -base64 24)"
echo ""

echo "# JWT Secret"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo ""

echo "# Encryption Key (64 hex chars)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo ""

echo "# MinIO Password"
echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
echo ""

echo "================================================"
echo "✅ Ключи сгенерированы!"
echo ""
echo "⚠️  ВАЖНО:"
echo "   - Сохраните эти ключи в безопасном месте"
echo "   - Никогда не коммитьте .env файл в Git"
echo "   - Используйте разные ключи для dev и production"
echo ""

