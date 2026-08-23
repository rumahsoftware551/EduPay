#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MIGRATION="$APP_DIR/backend/migrations/0048_full_local_migration.sql"
SITE="/etc/nginx/sites-available/edupay"

if [ ! -f "$CONFIG_FILE" ]; then echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$MIGRATION" ]; then echo "ERROR: migration V4.8 tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$SITE" ]; then echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; fi

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"
BACKUP="/var/backups/edupay/pre-v48-$(date +%Y%m%d-%H%M%S).sql.gz"

printf '[1/5] Backup PostgreSQL sebelum migrasi...\n'
sudo mkdir -p /var/backups/edupay
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP" >/dev/null
sudo chmod 600 "$BACKUP"
echo "Backup: $BACKUP"

printf '[2/5] Apply V4.8 migration schema...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[3/5] Configure V4.8 API route...\n'
sudo tee /etc/nginx/snippets/edupay-v48.conf >/dev/null <<NGINX
location ^~ /api/v48/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v48.php;
    fastcgi_param SCRIPT_NAME /backend/v48.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 120s;
    client_max_body_size 25m;
}
NGINX
if ! grep -q 'snippets/edupay-v48.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v48.conf;' "$SITE"
fi

printf '[4/5] Test PHP/Nginx...\n'
php -l "$APP_DIR/backend/v48.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[5/5] Health check...\n'
curl -fsS https://edupay.rumahsoftware.site/api/v48/health
printf '\nEduPay V4.8 siap untuk migrasi LocalStorage -> PostgreSQL.\n'
