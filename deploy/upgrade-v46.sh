#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MIGRATION="$APP_DIR/backend/migrations/0046_homeroom_teachers.sql"
SITE="/etc/nginx/sites-available/edupay"

[ -f "$CONFIG_FILE" ] || { echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; }
[ -f "$MIGRATION" ] || { echo "ERROR: migration V4.6 tidak ditemukan" >&2; exit 1; }
[ -f "$SITE" ] || { echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; }

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/4] Apply V4.6 academic migration...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[2/4] Configure academic API route...\n'
sudo tee /etc/nginx/snippets/edupay-v46.conf >/dev/null <<NGINX
location ^~ /api/v46/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v46.php;
    fastcgi_param SCRIPT_NAME /backend/v46.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
}
NGINX
if ! grep -q 'snippets/edupay-v46.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v46.conf;' "$SITE"
fi

printf '[3/4] Validate PHP and Nginx...\n'
php -l "$APP_DIR/backend/v46.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[4/4] Health check...\n'
curl -fsS https://edupay.rumahsoftware.site/api/v46/health
printf '\nEduPay V4.6 academic sync upgrade selesai.\n'
