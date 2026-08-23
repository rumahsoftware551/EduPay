#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MIGRATION="$APP_DIR/backend/migrations/00552_schema_compatibility.sql"
BACKUP_DIR="/var/backups/edupay"

[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
for F in backend/v551.php backend/v552.php backend/v1.php portal-state-v551.js index.html sw.js; do
  [ -f "$APP_DIR/$F" ] || { echo "ERROR: $F tidak ditemukan" >&2; exit 1; }
done
[ -f "$MIGRATION" ] || { echo 'ERROR: migration V5.5.2 tidak ditemukan' >&2; exit 1; }

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
SCHOOL_CODE="$(php -r '$c=require $argv[1]; echo $c["app"]["school_code"]??"default-school";' "$CONFIG_FILE")"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"

printf '[1/7] Backup PostgreSQL...\n'
sudo mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/edupay-pre-v552-$(date +%Y%m%d-%H%M%S).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null
sudo chmod 600 "$BACKUP_FILE"
echo "Backup: $BACKUP_FILE"

printf '[2/7] Apply schema compatibility repair...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIGRATION"

printf '[3/7] Verify required columns...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
SELECT table_name,column_name
FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='payments' AND column_name IN ('voided','voided_at','void_reason','voided_by')) OR
  (table_name='users' AND column_name IN ('salutation','nickname')) OR
  (table_name='bills' AND column_name IN ('payment_method','proof_name','proof_storage_key','proof_mime','proof_size','proof_uploaded_at'))
)
ORDER BY table_name,column_name;
SQL

printf '[4/7] Execute the same dashboard SQL directly...\n'
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -v school_code="$SCHOOL_CODE" <<'SQL'
WITH target_school AS (
  SELECT id FROM schools WHERE code=:'school_code' LIMIT 1
), bill_summary AS (
  SELECT
    COALESCE(SUM(CASE WHEN status<>'cancelled' THEN amount ELSE 0 END),0) total_billed,
    COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid_amount,
    COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END),0) unpaid_amount,
    COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) pending_count
  FROM bills WHERE school_id=(SELECT id FROM target_school)
), payment_summary AS (
  SELECT
    COALESCE(SUM(CASE WHEN COALESCE(voided,FALSE)=FALSE AND paid_at::date=CURRENT_DATE THEN amount ELSE 0 END),0) today,
    COALESCE(SUM(CASE WHEN COALESCE(voided,FALSE)=FALSE AND date_trunc('month',paid_at)=date_trunc('month',CURRENT_TIMESTAMP) THEN amount ELSE 0 END),0) AS month_amount
  FROM payments WHERE school_id=(SELECT id FROM target_school)
)
SELECT
  (SELECT id FROM target_school) school_id,
  (SELECT total_billed FROM bill_summary) total_billed,
  (SELECT paid_amount FROM bill_summary) paid,
  (SELECT unpaid_amount FROM bill_summary) unpaid,
  (SELECT pending_count FROM bill_summary) pending,
  (SELECT today FROM payment_summary) today,
  (SELECT month_amount FROM payment_summary) month_amount,
  (SELECT COUNT(*) FROM students WHERE school_id=(SELECT id FROM target_school) AND active=TRUE) active_students,
  (SELECT COUNT(*) FROM bills WHERE school_id=(SELECT id FROM target_school)) bills,
  (SELECT COUNT(*) FROM payments WHERE school_id=(SELECT id FROM target_school)) payments;
SQL

printf '[5/7] Syntax and asset preflight...\n'
php -l "$APP_DIR/backend/v551.php" >/dev/null
php -l "$APP_DIR/backend/v552.php" >/dev/null
php -l "$APP_DIR/backend/v1.php" >/dev/null
grep -q 'portal-state-v551.js?v=5.5.2' "$APP_DIR/index.html" || { echo 'ERROR: index belum V5.5.2' >&2; exit 1; }
grep -q 'edupay-professional-v5.5.2' "$APP_DIR/sw.js" || { echo 'ERROR: service worker belum V5.5.2' >&2; exit 1; }
grep -q "v552.php" "$APP_DIR/backend/v551.php" || { echo 'ERROR: portal proxy belum memakai V5.5.2' >&2; exit 1; }
grep -q "month_amount" "$APP_DIR/backend/v552.php" || { echo 'ERROR: dashboard SQL alias fix belum terpasang' >&2; exit 1; }

printf '[6/7] Restart PHP and reload Nginx...\n'
sudo systemctl restart "php${PHP_VER}-fpm"
sudo nginx -t
sudo systemctl reload nginx

printf '[7/7] Health + route check...\n'
sleep 2
curl -fsS https://edupay.rumahsoftware.site/api/v1/health; echo
CODE="$(curl -s -o /tmp/edupay-v552-state.json -w '%{http_code}' https://edupay.rumahsoftware.site/api/v1/portal/state || true)"
printf 'Unauthenticated portal-state HTTP: %s (expected 401)\n' "$CODE"
if [ "$CODE" != "401" ]; then cat /tmp/edupay-v552-state.json || true; fi
rm -f /tmp/edupay-v552-state.json

printf '\nEduPay V5.5.2 schema/portal repair selesai.\nBackup: %s\n' "$BACKUP_FILE"
printf 'Buka: https://edupay.rumahsoftware.site/?v=552\n'
