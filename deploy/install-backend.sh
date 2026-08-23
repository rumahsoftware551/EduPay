#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
DB_NAME="edupay"
DB_USER="edupay"
DOMAIN="edupay.rumahsoftware.site"
CONFIG_FILE="$APP_DIR/backend/config.php"

if [ "${EUID}" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

rand_hex(){ openssl rand -hex "$1"; }
DB_PASSWORD="${EDUPAY_DB_PASSWORD:-$(rand_hex 24)}"
BOOTSTRAP_KEY="${EDUPAY_BOOTSTRAP_KEY:-$(rand_hex 24)}"

printf '[1/8] Install PostgreSQL, PHP-FPM, PDO PostgreSQL...\n'
$SUDO apt-get update
$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql php-fpm php-pgsql php-mbstring openssl curl

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[2/8] Create database/user...\n'
$SUDO -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec
SQL

printf '[3/8] Apply schema...\n'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/backend/schema.sql"

printf '[4/8] Create backend config...\n'
$SUDO tee "$CONFIG_FILE" >/dev/null <<PHP
<?php
return [
    'db' => [
        'dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=${DB_NAME}',
        'user' => '${DB_USER}',
        'password' => '${DB_PASSWORD}',
    ],
    'app' => [
        'base_url' => 'https://${DOMAIN}',
        'cookie_name' => 'edupay_session',
        'session_ttl' => 43200,
        'school_code' => 'default-school',
        'school_name' => 'Sekolah EduPay',
        'bootstrap_key' => '${BOOTSTRAP_KEY}',
    ],
];
PHP
$SUDO chown root:www-data "$CONFIG_FILE"
$SUDO chmod 640 "$CONFIG_FILE"

printf '[5/8] Configure Nginx API route...\n'
$SUDO tee /etc/nginx/snippets/edupay-api.conf >/dev/null <<NGINX
location ^~ /api/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/api.php;
    fastcgi_param SCRIPT_NAME /backend/api.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
}
NGINX

SITE=/etc/nginx/sites-available/edupay
if ! $SUDO grep -q 'snippets/edupay-api.conf' "$SITE"; then
  $SUDO sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-api.conf;' "$SITE"
fi

printf '[6/8] Test services...\n'
$SUDO systemctl enable --now postgresql "php${PHP_VER}-fpm"
$SUDO nginx -t
$SUDO systemctl reload nginx

printf '[7/8] API health check...\n'
sleep 1
curl -fsS "https://${DOMAIN}/api/health" || true
printf '\n'

printf '[8/8] Backend installed.\n'
printf '\nIMPORTANT - save these values securely now:\n'
printf 'Database user     : %s\n' "$DB_USER"
printf 'Database password : %s\n' "$DB_PASSWORD"
printf 'Bootstrap key     : %s\n' "$BOOTSTRAP_KEY"
printf '\nConfig stored at: %s\n' "$CONFIG_FILE"
printf 'Next step: bootstrap admin/finance and migrate prototype data.\n'
