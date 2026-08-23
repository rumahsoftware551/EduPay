#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
DOMAIN="${EDUPAY_DOMAIN:-}"
SCHOOL_CODE="${EDUPAY_SCHOOL_CODE:-}"
SCHOOL_NAME="${EDUPAY_SCHOOL_NAME:-}"
ADMIN_PASSWORD="${EDUPAY_ADMIN_PASSWORD:-}"
FINANCE_PASSWORD="${EDUPAY_FINANCE_PASSWORD:-}"
SUPPORT_EMAIL="${EDUPAY_SUPPORT_EMAIL:-}"
ACADEMIC_YEAR="${EDUPAY_ACADEMIC_YEAR:-2026/2027}"
ENABLE_SSL="${EDUPAY_ENABLE_SSL:-1}"

fail(){ echo "ERROR: $*" >&2; exit 1; }
need_env(){ [ -n "${!1:-}" ] || fail "Environment $1 wajib diisi"; }
for V in DOMAIN SCHOOL_CODE SCHOOL_NAME ADMIN_PASSWORD FINANCE_PASSWORD SUPPORT_EMAIL; do need_env "$V"; done
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'EDUPAY_DOMAIN tidak valid'
[[ "$SCHOOL_CODE" =~ ^[a-z0-9][a-z0-9-]{2,49}$ ]] || fail 'EDUPAY_SCHOOL_CODE wajib lowercase, angka/tanda -, 3-50 karakter'
[[ "$SUPPORT_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || fail 'EDUPAY_SUPPORT_EMAIL tidak valid'
php -r '$p=$argv[1];exit(strlen($p)>=8&&preg_match("/[a-z]/",$p)&&preg_match("/[A-Z]/",$p)&&preg_match("/[0-9]/",$p)?0:1);' "$ADMIN_PASSWORD" || fail 'Password Admin minimal 8 karakter, huruf besar, huruf kecil, angka'
php -r '$p=$argv[1];exit(strlen($p)>=8&&preg_match("/[a-z]/",$p)&&preg_match("/[A-Z]/",$p)&&preg_match("/[0-9]/",$p)?0:1);' "$FINANCE_PASSWORD" || fail 'Password Finance minimal 8 karakter, huruf besar, huruf kecil, angka'
[ -f "$APP_DIR/backend/schema.sql" ] || fail "Source EduPay tidak ditemukan di $APP_DIR"
[ -f "$APP_DIR/backend/v1.php" ] || fail 'backend/v1.php tidak ditemukan'

as_root(){ if [ "$EUID" -eq 0 ]; then "$@"; else sudo "$@"; fi; }
as_postgres(){ if [ "$EUID" -eq 0 ]; then runuser -u postgres -- "$@"; else sudo -u postgres "$@"; fi; }

SAFE="$(printf '%s' "$SCHOOL_CODE" | tr '-' '_' | tr -cd 'a-z0-9_')"
DB_NAME="edupay_${SAFE}"
DB_USER="edupay_${SAFE}"
DB_PASSWORD="$(openssl rand -hex 24)"
BOOTSTRAP_KEY="$(openssl rand -hex 24)"
CONFIG_FILE="$APP_DIR/backend/config.php"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;' 2>/dev/null || true)"

printf '\n=== EduPay V6 Commercial Master Installer ===\nSchool : %s\nDomain : %s\nCode   : %s\n\n' "$SCHOOL_NAME" "$DOMAIN" "$SCHOOL_CODE"

printf '[1/10] Install production packages...\n'
as_root apt-get update
PKGS=(nginx postgresql postgresql-client php-fpm php-pgsql php-mbstring php-zip php-curl openssl curl ca-certificates)
[ "$ENABLE_SSL" = 1 ] && PKGS+=(certbot python3-certbot-nginx)
as_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "${PKGS[@]}"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_SOCK="/run/php/php${PHP_VER}-fpm.sock"
as_root systemctl enable --now postgresql nginx "php${PHP_VER}-fpm"

printf '[2/10] Create isolated PostgreSQL database...\n'
as_postgres psql -v ON_ERROR_STOP=1 -v db_user="$DB_USER" -v db_name="$DB_NAME" -v db_pass="$DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'db_user')\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'db_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname=:'db_name')\gexec
SQL

printf '[3/10] Write protected application config...\n'
TMP_CONFIG="$(mktemp)"
cat > "$TMP_CONFIG" <<PHP
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
        'school_code' => '${SCHOOL_CODE}',
        'school_name' => '${SCHOOL_NAME//\'/}',
        'bootstrap_key' => '${BOOTSTRAP_KEY}',
    ],
];
PHP
as_root install -o root -g www-data -m 640 "$TMP_CONFIG" "$CONFIG_FILE"
rm -f "$TMP_CONFIG"

printf '[4/10] Apply V6 fresh schema and idempotent migrations...\n'
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$APP_DIR/backend/schema.sql"
if compgen -G "$APP_DIR/backend/migrations/*.sql" >/dev/null; then
  while IFS= read -r MIG; do
    echo "Applying $(basename "$MIG")"
    PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$MIG"
  done < <(find "$APP_DIR/backend/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
fi

printf '[5/10] Create school, Admin and Finance production accounts...\n'
ADMIN_HASH="$(php -r 'echo password_hash($argv[1],PASSWORD_DEFAULT);' "$ADMIN_PASSWORD")"
FIN_HASH="$(php -r 'echo password_hash($argv[1],PASSWORD_DEFAULT);' "$FINANCE_PASSWORD")"
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -v school_code="$SCHOOL_CODE" -v school_name="$SCHOOL_NAME" -v support_email="$SUPPORT_EMAIL" -v academic_year="$ACADEMIC_YEAR" \
  -v admin_hash="$ADMIN_HASH" -v finance_hash="$FIN_HASH" <<'SQL'
INSERT INTO schools(code,name,support_email,academic_year_current,semester_current,app_name)
VALUES(:'school_code',:'school_name',:'support_email',:'academic_year','Ganjil','EduPay')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,support_email=EXCLUDED.support_email,academic_year_current=EXCLUDED.academic_year_current,updated_at=NOW();

WITH s AS (SELECT id FROM schools WHERE code=:'school_code')
INSERT INTO users(school_id,name,username,password_hash,role,status)
SELECT id,'Administrator','admin',:'admin_hash','admin','active' FROM s
ON CONFLICT(school_id,username) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active',updated_at=NOW();

WITH s AS (SELECT id FROM schools WHERE code=:'school_code')
INSERT INTO users(school_id,name,username,password_hash,role,status)
SELECT id,'Finance / Bendahara','finance',:'finance_hash','finance','active' FROM s
ON CONFLICT(school_id,username) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active',updated_at=NOW();
SQL

printf '[6/10] Prepare private storage, logs and backup folders...\n'
as_root mkdir -p /var/lib/edupay/proofs /var/lib/edupay/branding /var/lib/edupay/maintenance /var/backups/edupay/daily /var/log/edupay
as_root chown -R www-data:www-data /var/lib/edupay/proofs /var/lib/edupay/branding
as_root chown root:www-data /var/lib/edupay/maintenance
as_root chmod 750 /var/lib/edupay/proofs /var/lib/edupay/branding /var/lib/edupay/maintenance
as_root touch /var/log/edupay/app.log
as_root chown www-data:www-data /var/log/edupay/app.log
as_root chmod 640 /var/log/edupay/app.log
as_root chmod +x "$APP_DIR/deploy/backup-edupay.sh" "$APP_DIR/deploy/verify-restore.sh" "$APP_DIR/deploy/final-uat-v56.sh" 2>/dev/null || true

printf '[7/10] Configure Nginx production site...\n'
SITE="/etc/nginx/sites-available/edupay-${SAFE}"
TMP_SITE="$(mktemp)"
cat > "$TMP_SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    root ${APP_DIR};
    index index.html;
    client_max_body_size 8m;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "same-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location ^~ /api/v1/ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME ${APP_DIR}/backend/v1.php;
        fastcgi_param SCRIPT_NAME /backend/v1.php;
        fastcgi_param REQUEST_URI \$request_uri;
        fastcgi_pass unix:${PHP_SOCK};
        fastcgi_read_timeout 60s;
    }
    location ^~ /api/ { return 404; }
    location ~ ^/(backend|deploy|\.git)(/|$) { deny all; return 404; }
    location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
as_root install -o root -g root -m 644 "$TMP_SITE" "$SITE"
rm -f "$TMP_SITE"
as_root ln -sfn "$SITE" "/etc/nginx/sites-enabled/edupay-${SAFE}"
as_root rm -f /etc/nginx/sites-enabled/default
as_root nginx -t
as_root systemctl reload nginx

printf '[8/10] Configure HTTPS...\n'
if [ "$ENABLE_SSL" = 1 ]; then
  echo 'Requesting Let’s Encrypt certificate. DNS domain harus sudah mengarah ke VPS ini.'
  as_root certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$SUPPORT_EMAIL" --redirect
else
  echo 'WARNING: SSL dilewati. Session production memakai Secure cookie; aktifkan HTTPS sebelum digunakan pengguna.'
fi

printf '[9/10] Install automatic backup and run restore rehearsal...\n'
as_root cp "$APP_DIR/deploy/systemd/edupay-backup.service" /etc/systemd/system/edupay-backup.service
as_root cp "$APP_DIR/deploy/systemd/edupay-backup.timer" /etc/systemd/system/edupay-backup.timer
as_root systemctl daemon-reload
as_root systemctl enable --now edupay-backup.timer
as_root "$APP_DIR/deploy/backup-edupay.sh"
as_root "$APP_DIR/deploy/verify-restore.sh"

printf '[10/10] Production health checks...\n'
BASE="https://${DOMAIN}"
if [ "$ENABLE_SSL" != 1 ]; then BASE="http://${DOMAIN}"; fi
sleep 2
HEALTH="$(curl -fsS "$BASE/api/v1/health" || true)"
echo "$HEALTH"
printf '%s' "$HEALTH" | grep -q '"commercial_master":true' || fail 'API Commercial Master health gagal'
php -l "$APP_DIR/backend/v1.php" >/dev/null
php -l "$APP_DIR/backend/v56.php" >/dev/null
as_root nginx -t >/dev/null

printf '\n=== INSTALLATION COMPLETE ===\n'
printf 'URL              : %s\n' "$BASE"
printf 'School code      : %s\n' "$SCHOOL_CODE"
printf 'Admin username   : admin\n'
printf 'Finance username : finance\n'
printf 'Database         : %s\n' "$DB_NAME"
printf 'Database user    : %s\n' "$DB_USER"
printf 'DB password      : %s\n' "$DB_PASSWORD"
printf 'Bootstrap key    : %s\n' "$BOOTSTRAP_KEY"
printf '\nSimpan DB password/bootstrap key secara aman dan jangan commit backend/config.php.\n'
printf 'Berikutnya: login Admin → Pengaturan Sekolah → lengkapi profil/logo → jalankan Final UAT.\n'
