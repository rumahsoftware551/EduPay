#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
OUT_DIR="${EDUPAY_RELEASE_DIR:-/var/backups/edupay/releases}"
VERSION="6.0.0-rc1"
mkdir -p "$OUT_DIR"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

printf '=== EduPay V6.0 Release Gate ===\n'
chmod +x "$APP_DIR/deploy/final-uat-v56.sh"
if ! "$APP_DIR/deploy/final-uat-v56.sh" | tee "$TMP"; then
  echo 'RELEASE BLOCKED: Final UAT menghasilkan FAIL.' >&2
  exit 1
fi
if ! grep -q 'DECISION: PASS' "$TMP"; then
  echo 'RELEASE BLOCKED: UAT belum PASS tanpa warning.' >&2
  exit 1
fi

HEALTH="$(curl -fsS https://edupay.rumahsoftware.site/api/v1/health)"
printf '%s' "$HEALTH" | grep -q '"commercial_master":true' || { echo 'RELEASE BLOCKED: health commercial_master=false' >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
MANIFEST="$OUT_DIR/edupay-${VERSION}-${STAMP}.manifest.txt"
{
  echo "product=EduPay School Finance"
  echo "version=$VERSION"
  echo "generated_at=$(date --iso-8601=seconds)"
  echo "git_commit=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "uat=PASS"
  echo "health=$HEALTH"
  echo 'checksums:'
  find "$APP_DIR" -maxdepth 2 -type f \( -name '*.php' -o -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.sql' \) -print0 | sort -z | xargs -0 sha256sum
} > "$MANIFEST"
chmod 600 "$MANIFEST"
echo "RELEASE GATE PASS"
echo "Manifest: $MANIFEST"
