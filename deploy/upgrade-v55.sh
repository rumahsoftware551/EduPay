#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
BACKUP_DIR="/var/backups/edupay"
MIGRATION="$APP_DIR/backend/migrations/0055_reports_scale.sql"

[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
for F in backend/v1.php backend/v55.php backend/v55compat.php reports-scale-v55.js scale-safety-v55.js reports-scale-v55.css api-gateway-shim-v54.js; do
  [ -f "$APP_DIR/$F" ] || { echo "ERROR: $F tidak ditemukan" >&2; exit 1; }
done
[ -f "$MIGRATION" ] || { echo 'ERROR: migration V5.5 tidak ditemukan' >&2; exit 1; }

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"

printf '[1/7] Backup PostgreSQL...\n'
sudo mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/edupay-pre-v55-$(date +%Y%m%d-%H%M%S).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null
sudo chmod 600 "$BACKUP_FILE"
echo "Backup: $BACKUP_FILE"

printf '[2/7] Install PHP Zip for XLSX server export...\n'
sudo apt-get update -qq
sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y php-zip >/dev/null
sudo systemctl restart "php${PHP_VER}-fpm"
php -r 'if(!class_exists("ZipArchive")){fwrite(STDERR,"ERROR: ZipArchive belum aktif\n");exit(1);} echo "ZipArchive OK\n";'

printf '[3/7] Apply scale indexes...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[4/7] Syntax and runtime preflight...\n'
php -l "$APP_DIR/backend/v55.php" >/dev/null
php -l "$APP_DIR/backend/v55compat.php" >/dev/null
php -l "$APP_DIR/backend/v1.php" >/dev/null
if command -v node >/dev/null 2>&1; then
  node --check "$APP_DIR/reports-scale-v55.js"
  node --check "$APP_DIR/scale-safety-v55.js"
  node --check "$APP_DIR/api-gateway-shim-v54.js"
else
  echo 'INFO: node tidak tersedia; JS syntax check dilewati.'
fi
grep -q 'reports-scale-v55.js?v=5.5' "$APP_DIR/index.html" || { echo 'ERROR: index.html belum memuat V5.5' >&2; exit 1; }
grep -q 'scale-safety-v55.js?v=5.5' "$APP_DIR/index.html" || { echo 'ERROR: safety layer V5.5 belum aktif' >&2; exit 1; }
grep -q 'reports-scale-v55.css?v=5.5' "$APP_DIR/index.html" || { echo 'ERROR: CSS V5.5 belum aktif' >&2; exit 1; }
grep -q "edupay-professional-v5.5" "$APP_DIR/sw.js" || { echo 'ERROR: service worker belum V5.5' >&2; exit 1; }
grep -q '/api/v1/scale/compat/state' "$APP_DIR/api-gateway-shim-v54.js" || { echo 'ERROR: legacy snapshot belum diarahkan ke compatibility bridge' >&2; exit 1; }

printf '[5/7] Verify indexes...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -Atc "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_students_school_active_name','idx_bills_school_status_due_id','idx_payments_school_voided_paid_id') ORDER BY indexname;"

printf '[6/7] Reload application services...\n'
sudo systemctl restart "php${PHP_VER}-fpm"
sudo nginx -t
sudo systemctl reload nginx

printf '[7/7] Health check...\n'
sleep 2
HEALTH="$(curl -fsS https://edupay.rumahsoftware.site/api/v1/health)"
printf '%s\n' "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"version":"5.5"' || { echo 'ERROR: API v1 belum melaporkan V5.5' >&2; exit 1; }
printf '%s' "$HEALTH" | grep -q '"reports_scale":true' || { echo 'ERROR: reports_scale belum aktif' >&2; exit 1; }
LEGACY_CODE="$(curl -s -o /dev/null -w '%{http_code}' https://edupay.rumahsoftware.site/api/v49/state || true)"
printf 'Legacy direct route HTTP: %s (expected 404)\n' "$LEGACY_CODE"

printf '\nEduPay V5.5 Reports & Scale selesai.\nBackup: %s\n' "$BACKUP_FILE"
printf 'Buka: https://edupay.rumahsoftware.site/?v=55\n'
