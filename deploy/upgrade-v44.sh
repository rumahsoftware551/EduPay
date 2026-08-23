#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MIGRATION="$APP_DIR/backend/migrations/0044_parent_realtime.sql"
SITE="/etc/nginx/sites-available/edupay"

if [ ! -f "$CONFIG_FILE" ]; then echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$MIGRATION" ]; then echo "ERROR: migration V4.4 tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$SITE" ]; then echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; fi

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/4] Apply V4.4 database migration...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[2/4] Configure realtime API route...\n'
sudo tee /etc/nginx/snippets/edupay-v44.conf >/dev/null <<NGINX
location ^~ /api/v44/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v44.php;
    fastcgi_param SCRIPT_NAME /backend/v44.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
}
NGINX
if ! grep -q 'snippets/edupay-v44.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v44.conf;' "$SITE"
fi

printf '[3/4] Test PHP syntax and Nginx...\n'
php -l "$APP_DIR/backend/api.php"
php -l "$APP_DIR/backend/v44.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[4/4] API health...\n'
curl -fsS https://edupay.rumahsoftware.site/api/health
printf '\n'
curl -fsS https://edupay.rumahsoftware.site/api/v44/health
printf '\nEduPay V4.4 database/realtime upgrade selesai.\n'
