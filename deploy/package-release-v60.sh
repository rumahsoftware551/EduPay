#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
OUT_DIR="${EDUPAY_PACKAGE_DIR:-/var/backups/edupay/releases}"
VERSION="${EDUPAY_RELEASE_VERSION:-6.0.0-rc1}"
mkdir -p "$OUT_DIR"

if [ "${EDUPAY_SKIP_GATE:-0}" != 1 ]; then
  chmod +x "$APP_DIR/deploy/release-gate-v60.sh"
  "$APP_DIR/deploy/release-gate-v60.sh"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
PKG="$OUT_DIR/edupay-commercial-master-${VERSION}-${STAMP}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ROOT="$TMP/edupay-commercial-master"
mkdir -p "$ROOT"

tar -C "$APP_DIR" \
  --exclude='./.git' \
  --exclude='./backend/config.php' \
  --exclude='*.log' \
  --exclude='*.sql.gz' \
  --exclude='*.tar.gz' \
  --exclude='./node_modules' \
  --exclude='./.env' \
  --exclude='./.env.*' \
  --exclude='./uploads' \
  -cf - . | tar -C "$ROOT" -xf -

find "$ROOT" -type f -name '*.sh' -exec chmod 755 {} +
[ -f "$ROOT/backend/config.example.php" ] || { echo 'ERROR: config.example.php tidak ada' >&2; exit 1; }
[ ! -f "$ROOT/backend/config.php" ] || { echo 'ERROR: config.php ikut package' >&2; exit 1; }

tar -C "$TMP" -czf "$PKG" edupay-commercial-master
sha256sum "$PKG" > "$PKG.sha256"
chmod 600 "$PKG" "$PKG.sha256"
echo "PACKAGE READY: $PKG"
echo "CHECKSUM     : $PKG.sha256"
