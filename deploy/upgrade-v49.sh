#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
SITE="/etc/nginx/sites-available/edupay"
BACKUP_DIR="/var/backups/edupay"

if [ ! -f "$CONFIG_FILE" ]; then echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$APP_DIR/backend/v49.php" ]; then echo "ERROR: backend/v49.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$SITE" ]; then echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; fi

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"
DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/5] Backup PostgreSQL sebelum V4.9...\n'
sudo mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/edupay-pre-v49-$(date +%Y%m%d-%H%M%S).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null
sudo chmod 600 "$BACKUP_FILE"
printf 'Backup: %s\n' "$BACKUP_FILE"

printf '[2/5] Reconcile database migrations...\n'
for MIGRATION in \
  "$APP_DIR/backend/migrations/0044_parent_realtime.sql" \
  "$APP_DIR/backend/migrations/0046_homeroom_teachers.sql" \
  "$APP_DIR/backend/migrations/0048_full_local_migration.sql"
do
  if [ ! -f "$MIGRATION" ]; then echo "ERROR: migration hilang: $MIGRATION" >&2; exit 1; fi
  printf 'Applying %s...\n' "$(basename "$MIGRATION")"
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"
done

printf '[3/5] Configure V4.9 API route...\n'
sudo tee /etc/nginx/snippets/edupay-v49.conf >/dev/null <<NGINX
location ^~ /api/v49/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v49.php;
    fastcgi_param SCRIPT_NAME /backend/v49.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
    client_max_body_size 12m;
}
NGINX
if ! grep -q 'snippets/edupay-v49.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v49.conf;' "$SITE"
fi

printf '[4/5] Test PHP/Nginx and reload...\n'
php -l "$APP_DIR/backend/api.php"
php -l "$APP_DIR/backend/v44.php"
php -l "$APP_DIR/backend/v46.php"
php -l "$APP_DIR/backend/v47.php"
php -l "$APP_DIR/backend/v48.php"
php -l "$APP_DIR/backend/v49.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[5/5] V4.9 health check...\n'
curl -fsS https://edupay.rumahsoftware.site/api/v49/health
printf '\nEduPay V4.9 Stability upgrade selesai.\n'
printf 'Setelah login Admin/Finance, pastikan indikator header menunjukkan VPS tersinkron.\n'
