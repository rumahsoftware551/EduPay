#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/var/www/edupay"
cd "$APP_DIR"
[ -f activation-ui-v541.js ] || { echo 'ERROR: activation-ui-v541.js tidak ditemukan' >&2; exit 1; }
grep -q 'activation-ui-v541.js' index.html || { echo 'ERROR: index.html belum memuat activation-ui-v541.js' >&2; exit 1; }
grep -q 'Aktivasi Akun Wali' activation-ui-v541.js || { echo 'ERROR: tombol aktivasi tidak ditemukan dalam hotfix' >&2; exit 1; }
printf 'EduPay V5.4.1 guardian activation UI aktif.\n'
printf 'Health API: '
curl -fsS https://edupay.rumahsoftware.site/api/v1/health; echo
