#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
SITE="/etc/nginx/sites-available/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"

if [ ! -f "$CONFIG_FILE" ]; then echo "ERROR: backend/config.php tidak ditemukan" >&2; exit 1; fi
if [ ! -f "$SITE" ]; then echo "ERROR: konfigurasi Nginx EduPay tidak ditemukan" >&2; exit 1; fi

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[1/3] Configure V4.7 API route...\n'
sudo tee /etc/nginx/snippets/edupay-v47.conf >/dev/null <<NGINX
location ^~ /api/v47/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v47.php;
    fastcgi_param SCRIPT_NAME /backend/v47.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
}
NGINX
if ! grep -q 'snippets/edupay-v47.conf' "$SITE"; then
  sudo sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-v47.conf;' "$SITE"
fi

printf '[2/3] Test PHP and Nginx...\n'
php -l "$APP_DIR/backend/v47.php"
sudo nginx -t
sudo systemctl reload nginx

printf '[3/3] Health check...\n'
curl -fsS https://edupay.rumahsoftware.site/api/v47/health
printf '\nEduPay V4.7 student/guardian sync upgrade selesai.\n'
