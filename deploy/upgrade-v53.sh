#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/var/www/edupay"; CONFIG_FILE="$APP_DIR/backend/config.php"; SITE="/etc/nginx/sites-available/edupay"; BACKUP_DIR="/var/backups/edupay"
[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
[ -f "$SITE" ] || { echo 'ERROR: konfigurasi Nginx EduPay tidak ditemukan' >&2; exit 1; }
[ -f "$APP_DIR/backend/v53.php" ] || { echo 'ERROR: backend/v53.php tidak ditemukan' >&2; exit 1; }
DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"; DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"; DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"; DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"; DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"; PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"; PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"
printf '[1/5] Backup PostgreSQL...\n'; sudo mkdir -p "$BACKUP_DIR"; BACKUP_FILE="$BACKUP_DIR/edupay-pre-v53-$(date +%Y%m%d-%H%M%S).sql.gz"; PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null; sudo chmod 600 "$BACKUP_FILE"; echo "Backup: $BACKUP_FILE"
printf '[2/5] Apply Commercial Core migration...\n'; PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/backend/migrations/0053_commercial_core.sql"
printf '[3/5] Configure API V5.3 route...\n'; sudo tee /etc/nginx/snippets/edupay-v53.conf >/dev/null <<NGINX
location ^~ /api/v53/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v53.php;
    fastcgi_param SCRIPT_NAME /backend/v53.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
    client_max_body_size 6m;
}
NGINX
if ! grep -q 'snippets/edupay-v53.conf' "$SITE"; then sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v53.conf;' "$SITE"; fi
printf '[4/5] Validate and reload...\n'; php -l "$APP_DIR/backend/v53.php"; sudo nginx -t; sudo systemctl reload nginx
printf '[5/5] Health check...\n'; curl -fsS https://edupay.rumahsoftware.site/api/v53/health; echo; printf 'EduPay V5.3 Commercial Core selesai. Backup: %s\n' "$BACKUP_FILE"
