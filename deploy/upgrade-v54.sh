#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
SITE="/etc/nginx/sites-available/edupay"
BACKUP_DIR="/var/backups/edupay"
LOG_DIR="/var/log/edupay"

[ -f "$CONFIG_FILE" ] || { echo 'ERROR: backend/config.php tidak ditemukan' >&2; exit 1; }
[ -f "$SITE" ] || { echo 'ERROR: konfigurasi Nginx EduPay tidak ditemukan' >&2; exit 1; }
for F in api.php v49.php v50.php v501.php v502.php v51.php v52.php v53.php v1.php; do
  [ -f "$APP_DIR/backend/$F" ] || { echo "ERROR: backend/$F tidak ditemukan" >&2; exit 1; }
done
for F in production-runtime-v54.js api-gateway-shim-v54.js security-core-v54.js; do
  [ -f "$APP_DIR/$F" ] || { echo "ERROR: $F tidak ditemukan" >&2; exit 1; }
done

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/8] Backup PostgreSQL...\n'
sudo mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/edupay-pre-v54-$(date +%Y%m%d-%H%M%S).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" "$DB_NAME" | gzip | sudo tee "$BACKUP_FILE" >/dev/null
sudo chmod 600 "$BACKUP_FILE"
echo "Backup: $BACKUP_FILE"

printf '[2/8] Prepare centralized application log...\n'
sudo mkdir -p "$LOG_DIR"
sudo touch "$LOG_DIR/app.log"
sudo chown -R www-data:adm "$LOG_DIR"
sudo chmod 750 "$LOG_DIR"
sudo chmod 640 "$LOG_DIR/app.log"

printf '[3/8] Configure unified API v1 route...\n'
sudo tee /etc/nginx/snippets/edupay-v1.conf >/dev/null <<NGINX
location ^~ /api/v1/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v1.php;
    fastcgi_param SCRIPT_NAME /backend/v1.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
    client_max_body_size 6m;
}
NGINX
if ! grep -q 'snippets/edupay-v1.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v1.conf;' "$SITE"
fi

printf '[4/8] Disable public legacy API routes...\n'
# Legacy handlers remain on disk for internal dispatch/rollback, but are no longer reachable directly from the web.
sudo sed -i -E '/include snippets\/edupay-(api|v44|v46|v47|v48|v49|v50|v501|v502|v51|v52|v53)\.conf;/d' "$SITE"

printf '[5/8] Enable production security headers...\n'
sudo tee /etc/nginx/snippets/edupay-security.conf >/dev/null <<'NGINX'
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "same-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
NGINX
if ! grep -q 'snippets/edupay-security.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-security.conf;' "$SITE"
fi

printf '[6/8] Production runtime preflight...\n'
php -l "$APP_DIR/backend/v1.php" >/dev/null
if grep -q 'src="app.js' "$APP_DIR/index.html"; then echo 'ERROR: index.html masih memuat app.js demo' >&2; exit 1; fi
if [ -f "$APP_DIR/app.js" ]; then echo 'ERROR: app.js legacy masih ada di working tree. Pastikan git reset --hard origin/main sudah dijalankan.' >&2; exit 1; fi
if grep -Eq 'admin123|finance123|wali123' "$APP_DIR/production-runtime-v54.js"; then echo 'ERROR: credential demo ditemukan pada production runtime' >&2; exit 1; fi
for A in production-runtime-v54.js api-gateway-shim-v54.js security-core-v54.js; do grep -q "$A" "$APP_DIR/index.html" || { echo "ERROR: $A belum aktif pada index.html" >&2; exit 1; }; done

printf '[7/8] Validate and reload Nginx/PHP...\n'
sudo systemctl restart "php${PHP_VER}-fpm"
sudo nginx -t
sudo systemctl reload nginx

printf '[8/8] Security/health checks...\n'
sleep 2
curl -fsS https://edupay.rumahsoftware.site/api/v1/health; echo
printf 'Security headers:\n'
curl -fsSI https://edupay.rumahsoftware.site/ | grep -Ei 'strict-transport-security|content-security-policy|x-frame-options|x-content-type-options' || true
printf 'Legacy POST route check (expected non-JSON/404):\n'
LEGACY_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://edupay.rumahsoftware.site/api/v50/finance/bills/1/pay || true)"
echo "Legacy direct POST HTTP: $LEGACY_CODE"
printf '\nEduPay V5.4 Security & Core Consolidation selesai.\nBackup: %s\nLog: %s\n' "$BACKUP_FILE" "$LOG_DIR/app.log"
