#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/edupay"
CONFIG_FILE="$APP_DIR/backend/config.php"
MODE="${1:-all}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: $CONFIG_FILE tidak ditemukan."
  exit 1
fi

as_root(){ if [ "${EUID}" -eq 0 ]; then "$@"; else sudo "$@"; fi; }
as_postgres(){ if [ "${EUID}" -eq 0 ]; then runuser -u postgres -- "$@"; else sudo -u postgres "$@"; fi; }
rand_hex(){ openssl rand -hex "$1"; }

DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
BASE_URL="$(php -r '$c=require $argv[1]; echo $c["app"]["base_url"];' "$CONFIG_FILE")"
COOKIE_NAME="$(php -r '$c=require $argv[1]; echo $c["app"]["cookie_name"];' "$CONFIG_FILE")"
SESSION_TTL="$(php -r '$c=require $argv[1]; echo $c["app"]["session_ttl"];' "$CONFIG_FILE")"
SCHOOL_CODE="$(php -r '$c=require $argv[1]; echo $c["app"]["school_code"];' "$CONFIG_FILE")"
SCHOOL_NAME="$(php -r '$c=require $argv[1]; echo $c["app"]["school_name"];' "$CONFIG_FILE")"
CURRENT_DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
CURRENT_BOOTSTRAP="$(php -r '$c=require $argv[1]; echo $c["app"]["bootstrap_key"];' "$CONFIG_FILE")"

NEW_DB_PASSWORD="$CURRENT_DB_PASSWORD"
NEW_BOOTSTRAP="$CURRENT_BOOTSTRAP"

if [ "$MODE" = "all" ]; then
  NEW_DB_PASSWORD="$(rand_hex 24)"
  ESC_DB_PASSWORD="${NEW_DB_PASSWORD//\'/\'\'}"
  as_postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ${DB_USER} WITH PASSWORD '${ESC_DB_PASSWORD}';"
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "--bootstrap-only" ] || [ "$MODE" = "bootstrap-only" ]; then
  NEW_BOOTSTRAP="$(rand_hex 24)"
else
  echo "Usage: $0 [all|--bootstrap-only]"
  exit 1
fi

TMP="$(mktemp)"
cat >"$TMP" <<PHP
<?php
return [
    'db' => [
        'dsn' => '${DB_DSN}',
        'user' => '${DB_USER}',
        'password' => '${NEW_DB_PASSWORD}',
    ],
    'app' => [
        'base_url' => '${BASE_URL}',
        'cookie_name' => '${COOKIE_NAME}',
        'session_ttl' => ${SESSION_TTL},
        'school_code' => '${SCHOOL_CODE}',
        'school_name' => '${SCHOOL_NAME}',
        'bootstrap_key' => '${NEW_BOOTSTRAP}',
    ],
];
PHP
as_root install -o root -g www-data -m 640 "$TMP" "$CONFIG_FILE"
rm -f "$TMP"

KEY_FILE="/root/edupay-bootstrap-key.txt"
printf '%s\n' "$NEW_BOOTSTRAP" | as_root tee "$KEY_FILE" >/dev/null
as_root chmod 600 "$KEY_FILE"

if [ "$MODE" = "all" ]; then
  echo "Database password sudah dirotasi dan config diperbarui."
fi
echo "Bootstrap key sudah dirotasi."
echo "Key disimpan hanya di server: $KEY_FILE"
echo "Untuk melihat saat Setup Wizard: sudo cat $KEY_FILE"
echo "Jangan kirim/screenshot isi key tersebut."
