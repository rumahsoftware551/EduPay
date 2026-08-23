#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
CONFIG_FILE="$APP_DIR/backend/config.php"
BACKUP_ROOT="${EDUPAY_BACKUP_ROOT:-/var/backups/edupay/daily}"
MAINT_DIR="${EDUPAY_MAINT_DIR:-/var/lib/edupay/maintenance}"
BACKUP_DIR="${1:-}"

[ -f "$CONFIG_FILE" ] || { echo "ERROR: $CONFIG_FILE tidak ditemukan" >&2; exit 1; }
if [ -z "$BACKUP_DIR" ]; then BACKUP_DIR="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | tail -n1)"; fi
[ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/database.sql.gz" ] || { echo 'ERROR: backup database tidak ditemukan' >&2; exit 1; }
[ -f "$BACKUP_DIR/proofs.tar.gz" ] || { echo 'ERROR: proofs.tar.gz tidak ditemukan' >&2; exit 1; }
[ -f "$BACKUP_DIR/branding.tar.gz" ] || { echo 'ERROR: branding.tar.gz tidak ditemukan' >&2; exit 1; }

DB_DSN="$(php -r '$c=require $argv[1]; echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN" | sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
SAFE_DB="$(printf '%s' "$DB_NAME" | tr -cd 'A-Za-z0-9_' | cut -c1-30)"
TMP_DB="${SAFE_DB}_verify_$(date +%s)_$$"
sudo mkdir -p "$MAINT_DIR"; sudo chown root:www-data "$MAINT_DIR"; sudo chmod 750 "$MAINT_DIR"
STARTED="$(date --iso-8601=seconds)"; STATUS_FILE="$MAINT_DIR/restore-status.json"; STATUS_TMP="$STATUS_FILE.tmp"
publish_status(){ sudo chown root:www-data "$STATUS_FILE"; sudo chmod 640 "$STATUS_FILE"; }
cleanup(){ sudo -u postgres dropdb --if-exists "$TMP_DB" >/dev/null 2>&1 || true; }
fail_status(){ local code=$?; cleanup; sudo tee "$STATUS_TMP" >/dev/null <<EOF
{"ok":false,"version":"5.6","started_at":"$STARTED","finished_at":"$(date --iso-8601=seconds)","backup_dir":"$BACKUP_DIR","exit_code":$code}
EOF
sudo mv "$STATUS_TMP" "$STATUS_FILE"; publish_status; exit "$code"; }
trap fail_status ERR; trap cleanup EXIT

if [ -f "$BACKUP_DIR/manifest.sha256" ]; then (cd "$BACKUP_DIR" && sha256sum -c manifest.sha256); fi
tar -tzf "$BACKUP_DIR/proofs.tar.gz" >/dev/null; tar -tzf "$BACKUP_DIR/branding.tar.gz" >/dev/null
sudo -u postgres createdb "$TMP_DB"
gunzip -c "$BACKUP_DIR/database.sql.gz" | sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$TMP_DB" >/dev/null
COUNTS="$(sudo -u postgres psql -d "$TMP_DB" -At -F '|' -c "SELECT (SELECT COUNT(*) FROM schools),(SELECT COUNT(*) FROM students),(SELECT COUNT(*) FROM bills),(SELECT COUNT(*) FROM payments),(SELECT COUNT(*) FROM users WHERE role='parent');")"
IFS='|' read -r SCHOOLS STUDENTS BILLS PAYMENTS GUARDIANS <<<"$COUNTS"
[ "${SCHOOLS:-0}" -ge 1 ] || { echo 'ERROR: restore tidak memiliki data sekolah' >&2; false; }
FINISHED="$(date --iso-8601=seconds)"
sudo tee "$STATUS_TMP" >/dev/null <<EOF
{"ok":true,"version":"5.6","started_at":"$STARTED","finished_at":"$FINISHED","backup_dir":"$BACKUP_DIR","schools":${SCHOOLS:-0},"students":${STUDENTS:-0},"bills":${BILLS:-0},"payments":${PAYMENTS:-0},"guardians":${GUARDIANS:-0}}
EOF
sudo mv "$STATUS_TMP" "$STATUS_FILE"; publish_status
trap - ERR; cleanup; trap - EXIT
printf 'Restore verification PASS\nBackup: %s\nSiswa: %s | Tagihan: %s | Pembayaran: %s | Wali: %s\n' "$BACKUP_DIR" "$STUDENTS" "$BILLS" "$PAYMENTS" "$GUARDIANS"
