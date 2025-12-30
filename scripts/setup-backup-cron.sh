#!/bin/bash

# ===========================================
# Установка автоматического backup в cron
# ===========================================
# Запуск: sudo ./scripts/setup-backup-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_FILE="/etc/cron.d/lk-backup"

echo "Setting up automatic backups for lk.housler.ru"
echo "================================================"

# Проверка root
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: Please run as root (sudo)"
    exit 1
fi

# Создание директорий
echo "Creating directories..."
mkdir -p /var/www/lk.housler.ru/backups
mkdir -p /var/www/lk.housler.ru/logs
chown -R root:root /var/www/lk.housler.ru/backups
chmod 750 /var/www/lk.housler.ru/backups

# Установка прав на скрипты
echo "Setting permissions..."
chmod +x "$SCRIPT_DIR/backup.sh"
chmod +x "$SCRIPT_DIR/restore.sh"
chmod +x "$SCRIPT_DIR/verify-backup.sh"

# Установка cron
echo "Installing cron job..."
cat > "$CRON_FILE" << 'EOF'
# lk.housler.ru automatic backups
# Installed by setup-backup-cron.sh

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Daily backup at 3:00 AM
0 3 * * * root /var/www/lk.housler.ru/scripts/backup.sh --auto --production 2>&1

# Weekly verification on Sunday at 4:00 AM
0 4 * * 0 root /var/www/lk.housler.ru/scripts/verify-backup.sh 2>&1

# Cleanup old logs monthly
0 5 1 * * root find /var/www/lk.housler.ru/logs -name "*.log" -mtime +30 -delete 2>&1
EOF

chmod 644 "$CRON_FILE"

# Перезагрузка cron
service cron reload 2>/dev/null || systemctl reload cron 2>/dev/null || true

echo ""
echo "Setup complete!"
echo ""
echo "Configuration:"
echo "  - Backup directory: /var/www/lk.housler.ru/backups"
echo "  - Log file: /var/www/lk.housler.ru/logs/backup.log"
echo "  - Retention: 14 days"
echo ""
echo "Schedule:"
echo "  - Daily backup: 3:00 AM"
echo "  - Weekly verification: Sunday 4:00 AM"
echo ""
echo "Commands:"
echo "  - Manual backup: /var/www/lk.housler.ru/scripts/backup.sh"
echo "  - View logs: tail -f /var/www/lk.housler.ru/logs/backup.log"
echo "  - List backups: ls -lh /var/www/lk.housler.ru/backups/"
echo ""
