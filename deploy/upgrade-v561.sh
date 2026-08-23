#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
cd "$APP_DIR"

printf '=== EduPay V5.6.1 Final UAT Gate ===\n'
for f in deploy/upgrade-v56.sh deploy/final-uat-v56.sh backend/v56readiness.php uat-fixes-v56.js uat-fixes-v56.css index.html sw.js; do
  [ -f "$f" ] || { echo "ERROR: $f tidak ditemukan" >&2; exit 1; }
done
chmod +x deploy/upgrade-v56.sh deploy/final-uat-v56.sh

printf '\n[1/5] Complete/idempotent V5.6 deployment...\n'
./deploy/upgrade-v56.sh

printf '\n[2/5] Final hotfix syntax checks...\n'
php -l backend/v1.php >/dev/null
php -l backend/v56readiness.php >/dev/null
bash -n deploy/final-uat-v56.sh
if command -v node >/dev/null 2>&1; then
  node --check uat-fixes-v56.js
  node --check commercial-final-v56.js
else
  echo 'INFO: node tidak tersedia; JS syntax check dilewati.'
fi
grep -q 'uat-fixes-v56.js?v=5.6.1' index.html || { echo 'ERROR: index.html belum memuat UAT fix V5.6.1' >&2; exit 1; }
grep -q "edupay-commercial-master-v5.6.1" sw.js || { echo 'ERROR: PWA cache belum V5.6.1' >&2; exit 1; }

printf '\n[3/5] Restart PHP/Nginx after final hotfix...\n'
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
systemctl restart "php${PHP_VER}-fpm"
nginx -t
systemctl reload nginx

printf '\n[4/5] Public health smoke...\n'
sleep 2
HEALTH="$(curl -fsS https://edupay.rumahsoftware.site/api/v1/health)"
echo "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"version":"5.6"' || { echo 'ERROR: API health bukan V5.6' >&2; exit 1; }
printf '%s' "$HEALTH" | grep -q '"commercial_master":true' || { echo 'ERROR: commercial_master=false' >&2; exit 1; }
LEGACY="$(curl -s -o /dev/null -w '%{http_code}' https://edupay.rumahsoftware.site/api/v56/health || true)"
[ "$LEGACY" = 404 ] || { echo "ERROR: legacy direct route HTTP $LEGACY, expected 404" >&2; exit 1; }

printf '\n[5/5] Execute automated Final UAT...\n'
./deploy/final-uat-v56.sh

printf '\nEduPay V5.6.1 Final UAT Gate selesai.\n'
printf 'Buka UI terbaru: https://edupay.rumahsoftware.site/?v=561\n'
