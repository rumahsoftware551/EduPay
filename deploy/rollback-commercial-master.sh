#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
CONFIG_FILE="$APP_DIR/backend/config.php"
BACKUP_DIR="${1:-}"
TARGET_COMMIT="${2:-}"
CONFIRM="${EDUPAY_CONFIRM_ROLLBACK:-}"

[ "$CONFIRM" = YES ] || { echo 'ABORT: set EDUPAY_CONFIRM_ROLLBACK=YES untuk rollback destructive.' >&2; exit 1; }
[ -n "$BACKUP_DIR" ] || { echo 'Usage: EDUPAY_CONFIRM_ROLLBACK=YES sudo ./deploy/rollback-commercial-master.sh /var/backups/edupay/daily/TIMESTAMP [git_commit]' >&2; exit 1; }
[ -f "$CONFIG_FILE" ] || { echo 'ERROR: config.php tidak ditemukan' >&2; exit 1; }
for F in database.sql.gz proofs.tar.gz branding.tar.gz; do [ -f "$BACKUP_DIR/$F" ] || { echo "ERROR: $F tidak ditemukan" >&2; exit 1; }; done
[ ! -f "$BACKUP_DIR/manifest.sha256" ] || (cd "$BACKUP_DIR" && sha256sum -c manifest.sha256)

DB_USER="$(php -r '$c=require $argv[1];echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1];echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1];echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN"|sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"

printf 'ROLLBACK TARGET\nBackup : %s\nDatabase: %s\nCommit : %s\n' "$BACKUP_DIR" "$DB_NAME" "${TARGET_COMMIT:-tidak diubah}"

# Safety backup current state before destructive restore.
chmod +x "$APP_DIR/deploy/backup-edupay.sh"
"$APP_DIR/deploy/backup-edupay.sh"

sudo systemctl stop "php${PHP_VER}-fpm"
trap 'sudo systemctl start "php'"$PHP_VER"'-fpm" >/dev/null 2>&1 || true' EXIT

sudo -u postgres dropdb --if-exists "$DB_NAME"
sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
gunzip -c "$BACKUP_DIR/database.sql.gz" | PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 >/dev/null

sudo rm -rf /var/lib/edupay/proofs.rollback-new /var/lib/edupay/branding.rollback-new
sudo mkdir -p /var/lib/edupay/proofs.rollback-new /var/lib/edupay/branding.rollback-new
sudo tar -C /var/lib/edupay/proofs.rollback-new -xzf "$BACKUP_DIR/proofs.tar.gz"
sudo tar -C /var/lib/edupay/branding.rollback-new -xzf "$BACKUP_DIR/branding.tar.gz"
sudo rm -rf /var/lib/edupay/proofs /var/lib/edupay/branding
sudo mv /var/lib/edupay/proofs.rollback-new /var/lib/edupay/proofs
sudo mv /var/lib/edupay/branding.rollback-new /var/lib/edupay/branding
sudo chown -R www-data:www-data /var/lib/edupay/proofs /var/lib/edupay/branding
sudo chmod 750 /var/lib/edupay/proofs /var/lib/edupay/branding

if [ -n "$TARGET_COMMIT" ]; then
  git -C "$APP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo 'ERROR: source bukan git working tree; database sudah direstore tetapi code tidak dapat diubah.' >&2; exit 1; }
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" cat-file -e "$TARGET_COMMIT^{commit}"
  git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"
fi

sudo systemctl start "php${PHP_VER}-fpm"
sudo nginx -t
sudo systemctl reload nginx
trap - EXIT
BASE_URL="$(php -r '$c=require $argv[1];echo rtrim($c["app"]["base_url"]??"","/");' "$CONFIG_FILE")"
sleep 2
curl -fsS "$BASE_URL/api/v1/health"
echo
echo 'ROLLBACK PASS — lakukan smoke test Admin/Finance/Wali sebelum membuka akses penuh.'
