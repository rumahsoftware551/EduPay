#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MIGRATION="$APP_DIR/backend/migrations/0044_parent_realtime.sql"

if [ ! -f "$CONFIG_FILE" ]; then echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$MIGRATION" ]; then echo "ERROR: migration V4.4 tidak ditemukan" >&2; exit 1; fi

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
DB_HOST="${DB_HOST:-127.0.0.1}"

printf '[1/3] Apply V4.4 database migration...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[2/3] Test PHP syntax and Nginx...\n'
php -l "$APP_DIR/backend/api.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[3/3] API health...\n'
curl -fsS https://edupay.rumahsoftware.site/api/health
printf '\nEduPay V4.4 database upgrade selesai.\n'
