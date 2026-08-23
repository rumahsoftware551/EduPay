#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
CONFIG_FILE="$APP_DIR/backend/config.php"
BACKUP_ROOT="${EDUPAY_BACKUP_ROOT:-/var/backups/edupay/daily}"
PROOF_DIR="${EDUPAY_PROOF_DIR:-/var/lib/edupay/proofs}"
BRAND_DIR="${EDUPAY_BRAND_DIR:-/var/lib/edupay/branding}"
MAINT_DIR="${EDUPAY_MAINT_DIR:-/var/lib/edupay/maintenance}"

[ -f "$CONFIG_FILE" ] || { echo "ERROR: $CONFIG_FILE tidak ditemukan" >&2; exit 1; }
DB_USER="$(php -r '$c=require $argv[1]; echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1]; echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN" | sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
SCHOOL_CODE="$(php -r '$c=require $argv[1]; echo $c["app"]["school_code"]??"default-school";' "$CONFIG_FILE")"

sudo mkdir -p "$BACKUP_ROOT" "$PROOF_DIR" "$BRAND_DIR" "$MAINT_DIR"
RETENTION="$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -At -v school_code="$SCHOOL_CODE" -c "SELECT COALESCE(backup_retention_days,30) FROM schools WHERE code=:'school_code' LIMIT 1;" 2>/dev/null || true)"
[[ "$RETENTION" =~ ^[0-9]+$ ]] || RETENTION=30
if [ "$RETENTION" -lt 7 ] || [ "$RETENTION" -gt 365 ]; then RETENTION=30; fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$BACKUP_ROOT/$STAMP"
sudo mkdir -p "$RUN_DIR"
STARTED="$(date --iso-8601=seconds)"
STATUS_TMP="$MAINT_DIR/backup-status.json.tmp"
STATUS_FILE="$MAINT_DIR/backup-status.json"

fail_status(){
  local code=$?
  sudo tee "$STATUS_TMP" >/dev/null <<EOF
{"ok":false,"started_at":"$STARTED","finished_at":"$(date --iso-8601=seconds)","backup_dir":"$RUN_DIR","retention_days":$RETENTION,"exit_code":$code}
EOF
  sudo mv "$STATUS_TMP" "$STATUS_FILE"
  sudo chmod 640 "$STATUS_FILE"
  exit "$code"
}
trap fail_status ERR

PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" --no-owner --no-privileges "$DB_NAME" | gzip -9 | sudo tee "$RUN_DIR/database.sql.gz" >/dev/null
sudo tar -C "$PROOF_DIR" -czf "$RUN_DIR/proofs.tar.gz" .
sudo tar -C "$BRAND_DIR" -czf "$RUN_DIR/branding.tar.gz" .

sudo sh -c "cd '$RUN_DIR' && sha256sum database.sql.gz proofs.tar.gz branding.tar.gz > manifest.sha256"
DB_BYTES="$(sudo stat -c '%s' "$RUN_DIR/database.sql.gz")"
PROOF_BYTES="$(sudo stat -c '%s' "$RUN_DIR/proofs.tar.gz")"
BRAND_BYTES="$(sudo stat -c '%s' "$RUN_DIR/branding.tar.gz")"
FINISHED="$(date --iso-8601=seconds)"

sudo tee "$RUN_DIR/metadata.json" >/dev/null <<EOF
{"version":"5.6","school_code":"$SCHOOL_CODE","database":"$DB_NAME","started_at":"$STARTED","finished_at":"$FINISHED","retention_days":$RETENTION}
EOF
sudo tee "$STATUS_TMP" >/dev/null <<EOF
{"ok":true,"version":"5.6","started_at":"$STARTED","finished_at":"$FINISHED","backup_dir":"$RUN_DIR","retention_days":$RETENTION,"database_bytes":$DB_BYTES,"proofs_bytes":$PROOF_BYTES,"branding_bytes":$BRAND_BYTES}
EOF
sudo mv "$STATUS_TMP" "$STATUS_FILE"
sudo chmod -R go-rwx "$RUN_DIR"
sudo chmod 640 "$STATUS_FILE"

# Hapus backup harian yang melewati retention. Folder non-daily/pre-upgrade tidak disentuh.
sudo find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION" -exec rm -rf {} +
trap - ERR
printf 'EduPay backup OK: %s\nRetention: %s hari\n' "$RUN_DIR" "$RETENTION"
