#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/var/www/edupay"; CONFIG_FILE="$APP_DIR/backend/config.php"; SITE="/etc/nginx/sites-available/edupay"; BACKUP_DIR="/var/backups/edupay"; STORAGE="/var/lib/edupay/proofs"
[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
[ -f "$SITE" ] || { echo 'ERROR: konfigurasi Nginx EduPay tidak ditemukan' >&2; exit 1; }
for F in v49.php v50.php v501.php v502.php v51.php; do [ -f "$APP_DIR/backend/$F" ] || { echo "ERROR: backend/$F tidak ditemukan" >&2; exit 1; }; done
DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"; DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"; DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"; DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"; DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"; PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"; PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"
printf '[1/7] Backup PostgreSQL...\n'; sudo mkdir -p "$BACKUP_DIR"; BACKUP_FILE="$BACKUP_DIR/edupay-pre-v51-$(date +%Y%m%d-%H%M%S).sql.gz"; PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null; sudo chmod 600 "$BACKUP_FILE"; echo "Backup: $BACKUP_FILE"
printf '[2/7] Apply migrations...\n'; for MIG in 0044_parent_realtime.sql 0046_homeroom_teachers.sql 0048_full_local_migration.sql 0050_finance_safety.sql 0051_proof_storage.sql; do if [ -f "$APP_DIR/backend/migrations/$MIG" ]; then PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/backend/migrations/$MIG" >/dev/null; echo "Applied: $MIG"; fi; done
printf '[3/7] Prepare private proof storage...\n'; sudo mkdir -p "$STORAGE"; sudo chown -R www-data:www-data /var/lib/edupay; sudo chmod 750 /var/lib/edupay "$STORAGE"
printf '[4/7] Configure PHP upload limits...\n'; sudo tee "/etc/php/${PHP_VER}/fpm/conf.d/99-edupay-upload.ini" >/dev/null <<INI
upload_max_filesize=6M
post_max_size=7M
max_file_uploads=5
INI
sudo systemctl restart "php${PHP_VER}-fpm"
printf '[5/7] Configure latest API routes...\n';
for VER in v49 v50 v501 v502 v51; do
  sudo tee "/etc/nginx/snippets/edupay-${VER}.conf" >/dev/null <<NGINX
location ^~ /api/${VER}/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/${VER}.php;
    fastcgi_param SCRIPT_NAME /backend/${VER}.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
    client_max_body_size 6m;
}
NGINX
  if ! grep -q "snippets/edupay-${VER}.conf" "$SITE"; then sudo sed -i "/server_name edupay\\.rumahsoftware\\.site;/a\\    include snippets/edupay-${VER}.conf;" "$SITE"; fi
done
printf '[6/7] Validate and reload...\n'; for F in v49.php v50.php v501.php v502.php v51.php; do php -l "$APP_DIR/backend/$F" >/dev/null; done; sudo nginx -t; sudo systemctl reload nginx
printf '[7/7] Health checks...\n'; curl -fsS https://edupay.rumahsoftware.site/api/v501/health; echo; curl -fsS https://edupay.rumahsoftware.site/api/v502/health; echo; curl -fsS https://edupay.rumahsoftware.site/api/v51/health; echo; printf 'EduPay V5.1 upgrade selesai.\n'
