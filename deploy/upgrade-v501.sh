#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
SITE="/etc/nginx/sites-available/edupay"

[ -f "$CONFIG_FILE" ] || { echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; }
[ -f "$APP_DIR/backend/v501.php" ] || { echo "ERROR: backend/v501.php tidak ditemukan" >&2; exit 1; }
[ -f "$SITE" ] || { echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; }

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/3] Configure V5.0.1 stability API route...\n'
sudo tee /etc/nginx/snippets/edupay-v501.conf >/dev/null <<NGINX
location ^~ /api/v501/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v501.php;
    fastcgi_param SCRIPT_NAME /backend/v501.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
    client_max_body_size 12m;
}
NGINX
if ! grep -q 'snippets/edupay-v501.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v501.conf;' "$SITE"
fi

printf '[2/3] Validate PHP/Nginx and reload...\n'
php -l "$APP_DIR/backend/v501.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[3/3] Health check...\n'
curl -fsS https://edupay.rumahsoftware.site/api/v501/health
printf '\nEduPay V5.0.1 stability hotfix selesai.\n'
printf 'Uji login Admin dan Wali menggunakan URL ?v=501.\n'
