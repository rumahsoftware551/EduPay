#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${EDUPAY_APP_DIR:-/var/www/edupay}"
BASE_URL="${EDUPAY_BASE_URL:-https://edupay.rumahsoftware.site}"
CONFIG_FILE="$APP_DIR/backend/config.php"
TMP="$(mktemp -d /tmp/edupay-uat-XXXXXX)"
START_LOG_LINES=0
PASS=0; FAIL=0; WARN=0
TAG="UAT$(date +%s)$RANDOM"
PASSWORD='UatPass9A!'
ACT_PASSWORD='UatActivate9A!'
ADMIN_USER="uat_admin_${TAG}"
FIN_USER="uat_fin_${TAG}"
PHONE="0899${TAG//[^0-9]/}"; PHONE="${PHONE:0:14}"
ACT_PHONE="0898${TAG//[^0-9]/}"; ACT_PHONE="${ACT_PHONE:0:14}"
ADMIN_ID=''; FIN_ID=''; PARENT_ID=''; ACT_PARENT_ID=''; CLASS_ID=''; STUDENT1=''; STUDENT2=''; STUDENT3=''
BILL_APPROVE=''; BILL_REJECT=''; BILL_CASH=''; BILL_QRIS=''; BILL_TRANSFER=''; BILL_OTHER=''
PAY_APPROVE=''; PAY_CASH=''; PAY_QRIS=''; PAY_TRANSFER=''; PAY_OTHER=''

ok(){ PASS=$((PASS+1)); printf 'PASS  %s\n' "$*"; }
fail(){ FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$*"; }
warn(){ WARN=$((WARN+1)); printf 'WARN  %s\n' "$*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "ERROR: command $1 tidak tersedia" >&2; exit 1; }; }
need curl; need php; need psql; need gzip; need base64
[ -f "$CONFIG_FILE" ] || { echo "ERROR: $CONFIG_FILE tidak ditemukan" >&2; exit 1; }

DB_USER="$(php -r '$c=require $argv[1];echo $c["db"]["user"];' "$CONFIG_FILE")"
DB_PASSWORD="$(php -r '$c=require $argv[1];echo $c["db"]["password"];' "$CONFIG_FILE")"
DB_DSN="$(php -r '$c=require $argv[1];echo $c["db"]["dsn"];' "$CONFIG_FILE")"
DB_NAME="$(printf '%s' "$DB_DSN"|sed -n 's/.*dbname=\([^;]*\).*/\1/p')"
DB_HOST="$(printf '%s' "$DB_DSN"|sed -n 's/.*host=\([^;]*\).*/\1/p')"; DB_HOST="${DB_HOST:-127.0.0.1}"
SCHOOL_CODE="$(php -r '$c=require $argv[1];echo $c["app"]["school_code"]??"default-school";' "$CONFIG_FILE")"
PSQL=(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -At -q -v ON_ERROR_STOP=1)
sql(){ PGPASSWORD="$DB_PASSWORD" "${PSQL[@]}" "$@"; }
json_get(){ php -r '$d=json_decode(stream_get_contents(STDIN),true);$v=$d;foreach(explode(".",$argv[1]) as $k){if(!is_array($v)||!array_key_exists($k,$v)){exit;} $v=$v[$k];}if(is_bool($v))echo $v?"true":"false";elseif(is_array($v))echo json_encode($v);else echo $v;' "$1"; }

cleanup(){
  set +e
  if [ -n "$BILL_APPROVE$BILL_REJECT$BILL_CASH$BILL_QRIS$BILL_TRANSFER$BILL_OTHER" ]; then
    for bid in "$BILL_APPROVE" "$BILL_REJECT" "$BILL_CASH" "$BILL_QRIS" "$BILL_TRANSFER" "$BILL_OTHER"; do
      [ -n "$bid" ] || continue
      key="$(sql -v id="$bid" <<'SQL'
SELECT COALESCE(proof_storage_key,'') FROM bills WHERE id=:id;
SQL
)"
      [ -z "$key" ] || sudo rm -f "/var/lib/edupay/proofs/$key"
    done
  fi
  if [ -n "$STUDENT1$STUDENT2$STUDENT3" ]; then
    sql -v tag="$TAG" <<'SQL' >/dev/null 2>&1 || true
DELETE FROM audit_logs WHERE metadata::text LIKE '%' || :'tag' || '%' OR entity_id IN (SELECT id::text FROM bills WHERE external_id LIKE 'uat:' || :'tag' || ':%');
DELETE FROM payments WHERE bill_id IN (SELECT id FROM bills WHERE external_id LIKE 'uat:' || :'tag' || ':%');
DELETE FROM bills WHERE external_id LIKE 'uat:' || :'tag' || ':%';
DELETE FROM students WHERE external_id LIKE 'uat:' || :'tag' || ':%';
DELETE FROM classes WHERE external_id='uat:' || :'tag';
DELETE FROM users WHERE username IN (:'adminu',:'finu',:'phone',:'actphone');
SQL
  fi
  rm -rf "$TMP"
}
trap cleanup EXIT

printf '\n=== EduPay V5.6 FINAL UAT ===\nInstance: %s\nTag: %s\n\n' "$BASE_URL" "$TAG"
[ -f /var/log/edupay/app.log ] && START_LOG_LINES="$(wc -l </var/log/edupay/app.log)" || START_LOG_LINES=0

# A. Static/runtime preflight
printf '[A] Deployment & runtime\n'
for f in backend/v1.php backend/v56.php backend/v56readiness.php backend/v56finance.php backend/v56scale.php backend/v552.php backend/v51.php backend/v502.php uat-fixes-v56.js commercial-final-v56.js; do
  if [ -f "$APP_DIR/$f" ]; then ok "File $f tersedia"; else fail "File $f tidak ditemukan"; fi
done
for f in backend/v1.php backend/v56.php backend/v56readiness.php backend/v56finance.php backend/v56scale.php backend/v552.php backend/v51.php backend/v502.php; do
  if php -l "$APP_DIR/$f" >/dev/null 2>&1; then ok "PHP lint $f"; else fail "PHP lint $f"; fi
done
if command -v node >/dev/null 2>&1; then node --check "$APP_DIR/uat-fixes-v56.js" >/dev/null 2>&1 && ok 'JS lint uat-fixes-v56.js' || fail 'JS lint uat-fixes-v56.js'; else warn 'Node tidak tersedia; JS lint dilewati'; fi

authless_code="$(curl -sS -o "$TMP/health.json" -w '%{http_code}' "$BASE_URL/api/v1/health" || true)"
if [ "$authless_code" = 200 ] && [ "$(cat "$TMP/health.json"|json_get version)" = '5.6' ] && [ "$(cat "$TMP/health.json"|json_get commercial_master)" = true ]; then ok 'Live health V5.6 commercial_master=true'; else fail "Live health gagal HTTP $authless_code: $(cat "$TMP/health.json" 2>/dev/null || true)"; fi
legacy="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE_URL/api/v56/health" || true)"; [ "$legacy" = 404 ] && ok 'Direct legacy API tertutup (404)' || fail "Legacy API masih terbuka: HTTP $legacy"
brand_code="$(curl -sS -o "$TMP/brand.json" -w '%{http_code}' "$BASE_URL/api/v1/branding" || true)"; [ "$brand_code" = 200 ] && [ "$(cat "$TMP/brand.json"|json_get ok)" = true ] && ok 'Public branding endpoint' || fail 'Public branding endpoint'

# B. Backup/restore
printf '\n[B] Backup & restore\n'
if systemctl is-active --quiet edupay-backup.timer; then ok 'edupay-backup.timer aktif'; else fail 'edupay-backup.timer tidak aktif'; fi
if [ -f /var/lib/edupay/maintenance/backup-status.json ] && [ "$(cat /var/lib/edupay/maintenance/backup-status.json|json_get ok)" = true ]; then ok 'backup-status.json PASS'; else fail 'backup-status.json belum PASS'; fi
if [ -f /var/lib/edupay/maintenance/restore-status.json ] && [ "$(cat /var/lib/edupay/maintenance/restore-status.json|json_get ok)" = true ]; then ok 'restore-status.json PASS'; else fail 'restore-status.json belum PASS'; fi
latest_backup="$(find /var/backups/edupay/daily -mindepth 1 -maxdepth 1 -type d 2>/dev/null|sort|tail -n1)"
if [ -n "$latest_backup" ] && [ -f "$latest_backup/manifest.sha256" ] && (cd "$latest_backup" && sha256sum -c manifest.sha256 >/dev/null 2>&1); then ok 'Checksum backup terakhir valid'; else fail 'Checksum backup terakhir tidak valid/tidak ditemukan'; fi

# C. Create isolated fixtures in active school
printf '\n[C] Create temporary UAT fixtures\n'
SCHOOL_ID="$(sql -v school_code="$SCHOOL_CODE" <<'SQL'
SELECT id FROM schools WHERE code=:'school_code' LIMIT 1;
SQL
)"
[ -n "$SCHOOL_ID" ] && ok "School aktif ditemukan ID $SCHOOL_ID" || { fail 'School aktif tidak ditemukan'; exit 1; }
HASH="$(php -r 'echo password_hash($argv[1],PASSWORD_DEFAULT);' "$PASSWORD")"
ADMIN_ID="$(sql -v sid="$SCHOOL_ID" -v name="$TAG Admin" -v username="$ADMIN_USER" -v hash="$HASH" <<'SQL'
INSERT INTO users(school_id,name,username,password_hash,role,status) VALUES(:sid,:'name',:'username',:'hash','admin','active') RETURNING id;
SQL
)"
FIN_ID="$(sql -v sid="$SCHOOL_ID" -v name="$TAG Finance" -v username="$FIN_USER" -v hash="$HASH" <<'SQL'
INSERT INTO users(school_id,name,username,password_hash,role,status) VALUES(:sid,:'name',:'username',:'hash','finance','active') RETURNING id;
SQL
)"
PARENT_ID="$(sql -v sid="$SCHOOL_ID" -v name="$TAG Wali" -v username="$PHONE" -v hash="$HASH" <<'SQL'
INSERT INTO users(school_id,name,username,password_hash,role,status,salutation,nickname,activated_at) VALUES(:sid,:'name',:'username',:'hash','parent','active','Bapak','UAT',NOW()) RETURNING id;
SQL
)"
ACT_PARENT_ID="$(sql -v sid="$SCHOOL_ID" -v name="$TAG Aktivasi" -v username="$ACT_PHONE" <<'SQL'
INSERT INTO users(school_id,name,username,role,status) VALUES(:sid,:'name',:'username','parent','invited') RETURNING id;
SQL
)"
ACT_HASH="$(printf '654321'|sha256sum|awk '{print $1}')"
sql -v sid="$SCHOOL_ID" -v uid="$ACT_PARENT_ID" -v hash="$ACT_HASH" -v aid="$ADMIN_ID" <<'SQL' >/dev/null
INSERT INTO activation_tokens(school_id,user_id,token_hash,expires_at,created_by) VALUES(:sid,:uid,:'hash',NOW()+INTERVAL '24 hours',:aid);
SQL
CLASS_ID="$(sql -v sid="$SCHOOL_ID" -v ext="uat:$TAG" -v name="$TAG Kelas" <<'SQL'
INSERT INTO classes(school_id,external_id,name,level,academic_year,active) VALUES(:sid,:'ext',:'name','UAT','2099/2100',TRUE) RETURNING id;
SQL
)"
STUDENT1="$(sql -v sid="$SCHOOL_ID" -v ext="uat:$TAG:s1" -v nis="$TAG-01" -v name="$TAG Siswa A" -v cid="$CLASS_ID" -v g="$TAG Wali" -v phone="$PHONE" <<'SQL'
INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(:sid,:'ext',:'nis',:'name',:cid,:'g',:'phone',TRUE) RETURNING id;
SQL
)"
STUDENT2="$(sql -v sid="$SCHOOL_ID" -v ext="uat:$TAG:s2" -v nis="$TAG-02" -v name="$TAG Siswa B" -v cid="$CLASS_ID" -v g="$TAG Wali" -v phone="$PHONE" <<'SQL'
INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(:sid,:'ext',:'nis',:'name',:cid,:'g',:'phone',TRUE) RETURNING id;
SQL
)"
STUDENT3="$(sql -v sid="$SCHOOL_ID" -v ext="uat:$TAG:s3" -v nis="$TAG-03" -v name="$TAG Siswa Lain" -v cid="$CLASS_ID" <<'SQL'
INSERT INTO students(school_id,external_id,nis,name,class_id,guardian_name,guardian_phone,active) VALUES(:sid,:'ext',:'nis',:'name',:cid,'Wali Lain','081200000000',TRUE) RETURNING id;
SQL
)"
sql -v uid="$PARENT_ID" -v s1="$STUDENT1" -v s2="$STUDENT2" <<'SQL' >/dev/null
INSERT INTO guardian_students(guardian_user_id,student_id) VALUES(:uid,:s1),(:uid,:s2);
SQL
create_bill(){ local suffix="$1" sid="$2" amount="$3"; sql -v school="$SCHOOL_ID" -v ext="uat:$TAG:$suffix" -v student="$sid" -v title="$TAG $suffix" -v amount="$amount" <<'SQL'
INSERT INTO bills(school_id,external_id,student_id,title,amount,due_date,status) VALUES(:school,:'ext',:student,:'title',:amount,CURRENT_DATE,'unpaid') RETURNING id;
SQL
}
BILL_APPROVE="$(create_bill APPROVE "$STUDENT1" 11001)"; BILL_REJECT="$(create_bill REJECT "$STUDENT1" 11002)"; BILL_CASH="$(create_bill CASH "$STUDENT2" 11003)"; BILL_QRIS="$(create_bill QRIS "$STUDENT2" 11004)"; BILL_TRANSFER="$(create_bill TRANSFER "$STUDENT2" 11005)"; BILL_OTHER="$(create_bill OTHER "$STUDENT3" 11006)"
ok 'Fixture Admin/Finance/Wali, 3 siswa, 6 tagihan dibuat'

# HTTP helpers
csrf(){ local jar="$1" out; out="$(curl -sS -c "$jar" -b "$jar" "$BASE_URL/api/v1/csrf")"; printf '%s' "$out"|json_get token; }
login(){ local jar="$1" user="$2" pass="$3" token code; token="$(csrf "$jar")"; code="$(curl -sS -c "$jar" -b "$jar" -o "$TMP/login.json" -w '%{http_code}' -H 'Content-Type: application/json' -H "X-CSRF-Token: $token" --data "{\"username\":\"$user\",\"password\":\"$pass\"}" "$BASE_URL/api/v1/auth/login")"; [ "$code" = 200 ]; }
post_json(){ local jar="$1" path="$2" payload="$3" token; token="$(csrf "$jar")"; HTTP_CODE="$(curl -sS -c "$jar" -b "$jar" -o "$TMP/body.json" -w '%{http_code}' -H 'Content-Type: application/json' -H "X-CSRF-Token: $token" --data "$payload" "$BASE_URL$path")"; HTTP_BODY="$(cat "$TMP/body.json")"; }
get_auth(){ local jar="$1" path="$2"; HTTP_CODE="$(curl -sS -c "$jar" -b "$jar" -o "$TMP/body.out" -w '%{http_code}' "$BASE_URL$path")"; HTTP_BODY="$(cat "$TMP/body.out")"; }

ADMIN_JAR="$TMP/admin.cookies"; FIN_JAR="$TMP/fin.cookies"; PAR_JAR="$TMP/par.cookies"; ACT_JAR="$TMP/act.cookies"
printf '\n[D] Authentication, CSRF, dashboard, multi-child\n'
login "$ADMIN_JAR" "$ADMIN_USER" "$PASSWORD" && ok 'Login Admin server-session' || fail 'Login Admin'
login "$FIN_JAR" "$FIN_USER" "$PASSWORD" && ok 'Login Finance server-session' || fail 'Login Finance'
login "$PAR_JAR" "$PHONE" "$PASSWORD" && ok 'Login Parent server-session' || fail 'Login Parent'
# CSRF negative check on authenticated admin
csrf_negative="$(curl -sS -b "$ADMIN_JAR" -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$BASE_URL/api/v1/admin/guardians/sync")"; [ "$csrf_negative" = 419 ] && ok 'Mutation tanpa CSRF ditolak 419' || fail "CSRF negative test HTTP $csrf_negative"
get_auth "$ADMIN_JAR" '/api/v1/portal/state'; [ "$HTTP_CODE" = 200 ] && [ "$(printf '%s' "$HTTP_BODY"|json_get role)" = admin ] && ok 'Dashboard Admin dari PostgreSQL' || fail "Dashboard Admin: $HTTP_CODE $HTTP_BODY"
get_auth "$FIN_JAR" '/api/v1/portal/state'; [ "$HTTP_CODE" = 200 ] && [ "$(printf '%s' "$HTTP_BODY"|json_get role)" = finance ] && ok 'Dashboard Finance dari PostgreSQL' || fail "Dashboard Finance: $HTTP_CODE $HTTP_BODY"
get_auth "$PAR_JAR" '/api/v1/portal/state'; linked="$(printf '%s' "$HTTP_BODY"|php -r '$d=json_decode(stream_get_contents(STDIN),true);echo count($d["parentState"]["students"]??[]);')"; [ "$HTTP_CODE" = 200 ] && [ "$linked" -eq 2 ] && ok 'Parent multi-anak: 2 siswa terhubung' || fail "Parent multi-anak: $HTTP_CODE linked=$linked"
get_auth "$PAR_JAR" "/api/v1/portal/state?student_id=$STUDENT2"; selected="$(printf '%s' "$HTTP_BODY"|json_get parentState.studentId)"; [ "$HTTP_CODE" = 200 ] && [ "$selected" = "$STUDENT2" ] && ok 'Pemilihan anak via portal-state' || fail "Pemilihan anak gagal selected=$selected"
grep -q 'switchParentStudentV56' "$APP_DIR/uat-fixes-v56.js" && grep -q 'uat-fixes-v56.js?v=5.6.1' "$APP_DIR/index.html" && ok 'UI selector multi-anak terpasang' || fail 'UI selector multi-anak belum termuat'

printf '\n[E] Parent activation\n'
token_act="$(csrf "$ACT_JAR")"; code_act="$(curl -sS -c "$ACT_JAR" -b "$ACT_JAR" -o "$TMP/activate.json" -w '%{http_code}' -H 'Content-Type: application/json' -H "X-CSRF-Token: $token_act" --data "{\"username\":\"$ACT_PHONE\",\"code\":\"654321\",\"password\":\"$ACT_PASSWORD\"}" "$BASE_URL/api/v1/auth/activate")"; [ "$code_act" = 200 ] && ok 'Aktivasi akun wali production' || fail "Aktivasi wali: HTTP $code_act $(cat "$TMP/activate.json")"
login "$ACT_JAR" "$ACT_PHONE" "$ACT_PASSWORD" && ok 'Login setelah aktivasi' || fail 'Login setelah aktivasi gagal'

printf '\n[F] Private proof, staff notifications, verification\n'
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlQ0P8AAAAASUVORK5CYII=' | base64 -d > "$TMP/proof.png"
parent_upload(){ local bill="$1" token; token="$(csrf "$PAR_JAR")"; HTTP_CODE="$(curl -sS -c "$PAR_JAR" -b "$PAR_JAR" -o "$TMP/upload.json" -w '%{http_code}' -H "X-CSRF-Token: $token" -F "proof=@$TMP/proof.png;type=image/png" "$BASE_URL/api/v1/parent/bills/$bill/proof")"; HTTP_BODY="$(cat "$TMP/upload.json")"; }
parent_upload "$BILL_APPROVE"; [ "$HTTP_CODE" = 200 ] && ok 'Parent upload bukti private untuk approve' || fail "Upload proof approve: $HTTP_CODE $HTTP_BODY"
parent_upload "$BILL_REJECT"; [ "$HTTP_CODE" = 200 ] && ok 'Parent upload bukti private untuk reject' || fail "Upload proof reject: $HTTP_CODE $HTTP_BODY"
get_auth "$ADMIN_JAR" '/api/v1/staff/notifications'; [[ "$HTTP_CODE" = 200 && "$HTTP_BODY" == *"$BILL_APPROVE"* ]] && ok 'Notifikasi Admin menerima bukti baru' || fail 'Notifikasi Admin proof pending tidak ditemukan'
get_auth "$FIN_JAR" '/api/v1/staff/notifications'; [[ "$HTTP_CODE" = 200 && "$HTTP_BODY" == *"$BILL_REJECT"* ]] && ok 'Notifikasi Finance menerima bukti baru' || fail 'Notifikasi Finance proof pending tidak ditemukan'
get_auth "$ADMIN_JAR" '/api/v1/verification'; [[ "$HTTP_CODE" = 200 && "$HTTP_BODY" == *"\"id\":$BILL_APPROVE"* ]] && ok 'Antrean Verifikasi terlihat Admin' || fail 'Antrean Verifikasi Admin gagal'
post_json "$ADMIN_JAR" "/api/v1/verification/bills/$BILL_APPROVE/approve" '{}'; PAY_APPROVE="$(printf '%s' "$HTTP_BODY"|json_get payment.id)"; [ "$HTTP_CODE" = 200 ] && [ -n "$PAY_APPROVE" ] && ok 'Admin approve bukti + payment atomic' || fail "Admin approve: $HTTP_CODE $HTTP_BODY"
post_json "$FIN_JAR" "/api/v1/verification/bills/$BILL_REJECT/reject" '{"reason":"Final UAT reject test"}'; [ "$HTTP_CODE" = 200 ] && ok 'Finance reject bukti dengan alasan' || fail "Finance reject: $HTTP_CODE $HTTP_BODY"
proof_state="$(sql -v id="$BILL_REJECT" <<'SQL'
SELECT status||'|'||COALESCE(proof_storage_key,'') FROM bills WHERE id=:id;
SQL
)"; [ "$proof_state" = 'unpaid|' ] && ok 'Reject membersihkan proof metadata dan reset unpaid' || fail "Reject state tidak sesuai: $proof_state"

printf '\n[G] Finance Cash / QRIS / Transfer / anti-double / Void\n'
pay_bill(){ local bill="$1" method="$2"; post_json "$FIN_JAR" "/api/v1/finance/bills/$bill/pay" "{\"method\":\"$method\"}"; }
pay_bill "$BILL_CASH" Cash; PAY_CASH="$(printf '%s' "$HTTP_BODY"|json_get payment.id)"; [ "$HTTP_CODE" = 200 ] && ok 'Finance Cash payment' || fail "Cash payment: $HTTP_CODE $HTTP_BODY"
pay_bill "$BILL_CASH" Cash; [ "$HTTP_CODE" = 409 ] && ok 'Anti double-payment menolak transaksi kedua' || fail "Anti double-payment expected 409 got $HTTP_CODE"
pay_bill "$BILL_QRIS" QRIS; PAY_QRIS="$(printf '%s' "$HTTP_BODY"|json_get payment.id)"; [ "$HTTP_CODE" = 200 ] && ok 'Finance QRIS payment' || fail "QRIS payment: $HTTP_CODE $HTTP_BODY"
pay_bill "$BILL_TRANSFER" Transfer; PAY_TRANSFER="$(printf '%s' "$HTTP_BODY"|json_get payment.id)"; [ "$HTTP_CODE" = 200 ] && ok 'Finance Transfer payment' || fail "Transfer payment: $HTTP_CODE $HTTP_BODY"
pay_bill "$BILL_OTHER" Cash; PAY_OTHER="$(printf '%s' "$HTTP_BODY"|json_get payment.id)"; [ "$HTTP_CODE" = 200 ] && ok 'Payment siswa tidak terhubung dibuat untuk ACL test' || fail 'Other payment gagal'
PREFIX="$(sql -v sid="$SCHOOL_ID" <<'SQL'
SELECT receipt_prefix FROM schools WHERE id=:sid;
SQL
)"; receipt_cash="$(sql -v id="$PAY_CASH" <<'SQL'
SELECT receipt FROM payments WHERE id=:id;
SQL
)"; [[ "$receipt_cash" == "$PREFIX-"* ]] && ok "Prefix kwitansi server ($PREFIX)" || fail "Prefix receipt tidak sesuai: $receipt_cash"
post_json "$FIN_JAR" "/api/v1/finance/payments/$PAY_CASH/void" '{"reason":"Final UAT void test"}'; [ "$HTTP_CODE" = 200 ] && ok 'Void pembayaran dengan alasan' || fail "Void payment: $HTTP_CODE $HTTP_BODY"
void_state="$(sql -v p="$PAY_CASH" -v b="$BILL_CASH" <<'SQL'
SELECT (SELECT voided::text FROM payments WHERE id=:p)||'|'||(SELECT status FROM bills WHERE id=:b);
SQL
)"; [ "$void_state" = 'true|unpaid' ] && ok 'Void mempertahankan ledger dan membuka kembali tagihan' || fail "Void state salah: $void_state"

printf '\n[H] Official receipt ACL\n'
get_auth "$PAR_JAR" "/api/v1/commercial/receipts/$PAY_APPROVE"; [ "$HTTP_CODE" = 200 ] && [[ "$HTTP_BODY" == *'KWITANSI PEMBAYARAN'* ]] && ok 'Parent membuka kwitansi anak terhubung' || fail "Receipt parent sendiri: HTTP $HTTP_CODE"
get_auth "$PAR_JAR" "/api/v1/commercial/receipts/$PAY_OTHER"; [ "$HTTP_CODE" = 403 ] && ok 'Parent dilarang membuka kwitansi siswa lain' || fail "Receipt ACL expected 403 got $HTTP_CODE"

printf '\n[I] Admin scale, reports, exports, commercial readiness\n'
get_auth "$ADMIN_JAR" "/api/v1/scale/students?q=$TAG&page=1&per_page=10&status=all"; [[ "$HTTP_CODE" = 200 && "$HTTP_BODY" == *"$TAG-01"* ]] && ok 'Server-side student search/pagination' || fail 'Student scale search gagal'
get_auth "$ADMIN_JAR" "/api/v1/scale/bills?q=$TAG&page=1&per_page=10"; [ "$HTTP_CODE" = 200 ] && ok 'Server-side bill search/pagination' || fail 'Bill scale query gagal'
get_auth "$ADMIN_JAR" '/api/v1/scale/reports/summary'; [ "$HTTP_CODE" = 200 ] && ok 'SQL report summary' || fail "Report summary: $HTTP_CODE $HTTP_BODY"
CSV_CODE="$(curl -sS -b "$ADMIN_JAR" -o "$TMP/report.csv" -w '%{http_code}' "$BASE_URL/api/v1/scale/export/payments?format=csv")"; [ "$CSV_CODE" = 200 ] && [ -s "$TMP/report.csv" ] && ok 'Export CSV server-side' || fail 'Export CSV gagal'
XLSX_CODE="$(curl -sS -b "$ADMIN_JAR" -o "$TMP/report.xlsx" -w '%{http_code}' "$BASE_URL/api/v1/scale/export/payments?format=xlsx")"; [ "$XLSX_CODE" = 200 ] && [ -s "$TMP/report.xlsx" ] && ok 'Export XLSX server-side' || fail 'Export XLSX gagal'
get_auth "$ADMIN_JAR" '/api/v1/commercial/admin/maintenance'; [ "$HTTP_CODE" = 200 ] && ok 'Commercial maintenance endpoint' || fail 'Commercial maintenance endpoint gagal'
get_auth "$ADMIN_JAR" '/api/v1/commercial/admin/readiness'; readiness="$(printf '%s' "$HTTP_BODY"|json_get score)"; [ "$HTTP_CODE" = 200 ] && ok "Commercial readiness endpoint score=${readiness:-?}%" || fail "Commercial readiness endpoint: $HTTP_CODE $HTTP_BODY"
if [ "${readiness:-0}" = 100 ]; then ok 'Commercial Readiness 100%'; else warn "Commercial Readiness belum 100% (${readiness:-0}%). Lengkapi field wajib di Pengaturan Sekolah."; fi

printf '\n[J] New application errors during UAT\n'
if [ -f /var/log/edupay/app.log ]; then
  NEWLOG="$TMP/newlog.txt"; tail -n +$((START_LOG_LINES+1)) /var/log/edupay/app.log > "$NEWLOG" || true
  if grep -E 'uncaught_exception|PHP Fatal|SQLSTATE.*ERROR' "$NEWLOG" >/dev/null 2>&1; then fail "Ada error baru di app.log"; grep -E 'uncaught_exception|PHP Fatal|SQLSTATE.*ERROR' "$NEWLOG" | tail -n 10; else ok 'Tidak ada fatal/uncaught DB error baru selama UAT'; fi
else warn '/var/log/edupay/app.log tidak ditemukan'; fi

printf '\n=== FINAL UAT RESULT ===\nPASS: %d\nWARN: %d\nFAIL: %d\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  if [ "$WARN" -eq 0 ]; then echo 'DECISION: PASS — kandidat dapat lanjut Release Packaging V6.0.'; else echo 'DECISION: CONDITIONAL PASS — tidak ada blocker teknis; selesaikan WARN sebelum label siap dijual.'; fi
  exit 0
fi
echo 'DECISION: FAIL — jangan dijual/clone sebelum semua blocker diperbaiki.'
exit 1
