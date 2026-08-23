#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"

[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
for F in backend/v1.php backend/v551.php portal-state-v551.js index.html sw.js; do
  [ -f "$APP_DIR/$F" ] || { echo "ERROR: $F tidak ditemukan" >&2; exit 1; }
done

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
SCHOOL_CODE="$(php -r '$c=require $argv[1]; echo $c["app"]["school_code"]??"default-school";' "$CONFIG_FILE")"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"

printf '[1/5] Syntax preflight...\n'
php -l "$APP_DIR/backend/v1.php" >/dev/null
php -l "$APP_DIR/backend/v551.php" >/dev/null
grep -q 'portal-state-v551.js?v=5.5.1' "$APP_DIR/index.html" || { echo 'ERROR: portal-state V5.5.1 belum aktif di index.html' >&2; exit 1; }
grep -q "edupay-professional-v5.5.1" "$APP_DIR/sw.js" || { echo 'ERROR: service worker belum V5.5.1' >&2; exit 1; }

printf '[2/5] Verify PostgreSQL data for school code: %s...\n' "$SCHOOL_CODE"
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -v school_code="$SCHOOL_CODE" <<'SQL'
SELECT
  s.id AS school_id,
  s.code,
  s.name,
  (SELECT COUNT(*) FROM classes c WHERE c.school_id=s.id) AS classes,
  (SELECT COUNT(*) FROM students st WHERE st.school_id=s.id) AS students,
  (SELECT COUNT(*) FROM bills b WHERE b.school_id=s.id) AS bills,
  (SELECT COUNT(*) FROM payments p WHERE p.school_id=s.id) AS payments,
  (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='parent') AS guardian_accounts
FROM schools s
WHERE s.code=:'school_code';
SQL

printf '[3/5] Restart PHP and validate Nginx...\n'
sudo systemctl restart "php${PHP_VER}-fpm"
sudo nginx -t
sudo systemctl reload nginx

printf '[4/5] API health...\n'
sleep 2
HEALTH="$(curl -fsS https://edupay.rumahsoftware.site/api/v1/health)"
printf '%s\n' "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"version":"5.5.1"' || { echo 'ERROR: API belum V5.5.1' >&2; exit 1; }
printf '%s' "$HEALTH" | grep -q '"portal_state":true' || { echo 'ERROR: portal_state belum aktif' >&2; exit 1; }

printf '[5/5] Portal-state route check...\n'
CODE="$(curl -s -o /tmp/edupay-v551-state.json -w '%{http_code}' https://edupay.rumahsoftware.site/api/v1/portal/state || true)"
printf 'Unauthenticated portal-state HTTP: %s (expected 401)\n' "$CODE"
if [ "$CODE" != "401" ]; then
  echo 'WARNING: portal state tidak memberi 401 saat tanpa session. Response:' >&2
  cat /tmp/edupay-v551-state.json >&2 || true
fi
rm -f /tmp/edupay-v551-state.json

printf '\nEduPay V5.5.1 Portal State Hotfix selesai.\nBuka: https://edupay.rumahsoftware.site/?v=551\n'
