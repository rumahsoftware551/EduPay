#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
DB_NAME="edupay"
DB_USER="edupay"
DOMAIN="edupay.rumahsoftware.site"
CONFIG_FILE="$APP_DIR/backend/config.php"

as_root(){
  if [ "${EUID}" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

as_postgres(){
  if [ "${EUID}" -eq 0 ]; then
    runuser -u postgres -- "$@"
  else
    sudo -u postgres "$@"
  fi
}

rand_hex(){ openssl rand -hex "$1"; }
DB_PASSWORD="${EDUPAY_DB_PASSWORD:-$(rand_hex 24)}"
BOOTSTRAP_KEY="${EDUPAY_BOOTSTRAP_KEY:-$(rand_hex 24)}"

printf '[1/8] Install PostgreSQL, PHP-FPM, PDO PostgreSQL...\n'
as_root apt-get update
as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-client php-fpm php-pgsql php-mbstring openssl curl

if ! command -v psql >/dev/null 2>&1; then
  echo 'ERROR: psql tidak ditemukan setelah instalasi.' >&2
  exit 1
fi
if ! command -v php >/dev/null 2>&1; then
  echo 'ERROR: PHP tidak ditemukan setelah instalasi.' >&2
  exit 1
fi

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"

printf '[2/8] Start PostgreSQL and create database/user...\n'
as_root systemctl enable --now postgresql

as_postgres psql -v ON_ERROR_STOP=1 <<SQL
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
as_root mkdir -p "$APP_DIR/backend"
TMP_CONFIG="$(mktemp)"
cat >"$TMP_CONFIG" <<PHP
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
as_root install -o root -g www-data -m 640 "$TMP_CONFIG" "$CONFIG_FILE"
rm -f "$TMP_CONFIG"

printf '[5/8] Configure Nginx API route...\n'
TMP_NGINX="$(mktemp)"
cat >"$TMP_NGINX" <<NGINX
location ^~ /api/ {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/api.php;
    fastcgi_param SCRIPT_NAME /backend/api.php;
    fastcgi_param REQUEST_URI \$request_uri;
    fastcgi_pass unix:${PHP_SOCK};
    fastcgi_read_timeout 60s;
}
NGINX
as_root install -o root -g root -m 644 "$TMP_NGINX" /etc/nginx/snippets/edupay-api.conf
rm -f "$TMP_NGINX"

SITE=/etc/nginx/sites-available/edupay
if [ ! -f "$SITE" ]; then
  echo "ERROR: Konfigurasi Nginx EduPay tidak ditemukan di $SITE" >&2
  exit 1
fi
if ! grep -q 'snippets/edupay-api.conf' "$SITE"; then
  as_root sed -i '/server_name edupay\.rumahsoftware\.site;/a\\    include snippets/edupay-api.conf;' "$SITE"
fi

printf '[6/8] Enable PHP-FPM and test Nginx...\n'
as_root systemctl enable --now "php${PHP_VER}-fpm"
if [ ! -S "$PHP_SOCK" ]; then
  echo "ERROR: PHP-FPM socket tidak ditemukan: $PHP_SOCK" >&2
  exit 1
fi
as_root nginx -t
as_root systemctl reload nginx

printf '[7/8] API health check...\n'
sleep 2
HEALTH="$(curl -fsS "https://${DOMAIN}/api/health" || true)"
printf '%s\n' "$HEALTH"
if ! printf '%s' "$HEALTH" | grep -q '"ok"'; then
  echo 'WARNING: API health belum mengembalikan JSON ok=true. Cek Nginx/PHP-FPM jika instalasi selesai tanpa error.' >&2
fi

printf '[8/8] Backend installed.\n'
printf '\nIMPORTANT - save these values securely now:\n'
printf 'Database user     : %s\n' "$DB_USER"
printf 'Database password : %s\n' "$DB_PASSWORD"
printf 'Bootstrap key     : %s\n' "$BOOTSTRAP_KEY"
printf '\nConfig stored at: %s\n' "$CONFIG_FILE"
printf 'Next step: bootstrap admin/finance and migrate prototype data.\n'
