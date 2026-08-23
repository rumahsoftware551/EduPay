# UAT EduPay V5.6.1 Commercial Master

Status: **FINAL GATE READY — LIVE EXECUTION REQUIRED**.

Dua blocker yang ditemukan saat source-level final UAT sudah diperbaiki:
1. Commercial Readiness kini membaca `restore-status.json` melalui handler `backend/v56readiness.php`.
2. Portal Wali kini mempunyai pemilih anak untuk akun multi-anak melalui `uat-fixes-v56.js`.

Final UAT live dijalankan dengan:

```bash
cd /var/www/edupay
git fetch origin main
git reset --hard origin/main
chmod +x deploy/upgrade-v561.sh
sudo ./deploy/upgrade-v561.sh
```

`upgrade-v561.sh` menyelesaikan deployment V5.6 secara idempotent, memasang hotfix V5.6.1, lalu menjalankan `deploy/final-uat-v56.sh`.

Runner membuat data UAT sementara di school instance aktif, menguji alur server sebenarnya, lalu membersihkan fixture dan file bukti UAT melalui trap cleanup. **Jangan memberi label siap dijual bila hasil akhir memiliki FAIL > 0.**

## A. Deployment & Health
- [ ] `deploy/upgrade-v56.sh` selesai sampai `[9/9]`.
- [ ] `/api/v1/health` menampilkan `version: 5.6` dan `commercial_master: true`.
- [ ] Direct legacy `/api/v56/health` menghasilkan HTTP 404.
- [ ] Tidak ada PHP fatal/uncaught database error baru pada `/var/log/edupay/app.log`.
- [ ] `index.html` memuat `uat-fixes-v56.js?v=5.6.1`.
- [ ] PWA cache adalah `edupay-commercial-master-v5.6.1`.

## B. Backup & Restore
- [ ] `edupay-backup.timer` aktif.
- [ ] Backup pertama menghasilkan `database.sql.gz`, `proofs.tar.gz`, `branding.tar.gz`, `manifest.sha256`.
- [ ] `backup-status.json` berstatus `ok:true`.
- [ ] Checksum backup terakhir valid.
- [ ] Restore rehearsal ke database sementara PASS.
- [ ] `restore-status.json` berstatus `ok:true`.
- [ ] Database produksi tidak diganti/direstore selama rehearsal.

## C. Authentication & Security
- [ ] Admin login menggunakan server session.
- [ ] Finance login menggunakan server session.
- [ ] Parent login menggunakan server session.
- [ ] Mutation tanpa CSRF ditolak HTTP 419.
- [ ] Credential demo tidak ada pada runtime production.
- [ ] Legacy direct API route tertutup.

## D. Parent / Wali
- [ ] Aktivasi akun wali dengan kode aktivasi normal.
- [ ] Login setelah aktivasi normal.
- [ ] Portal-state membaca PostgreSQL.
- [ ] Akun dengan dua anak menerima dua relasi siswa.
- [ ] Pemilih anak mengubah `student_id` yang sedang dilihat.
- [ ] Dashboard, Tagihan Saya, Riwayat, dan Profil mengikuti anak terpilih.
- [ ] Upload bukti JPG/PNG/PDF disimpan private di VPS.
- [ ] Parent dapat membuka kwitansi anak terhubung.
- [ ] Parent mendapat HTTP 403 untuk kwitansi siswa yang tidak terhubung.

## E. Verifikasi & Notifikasi
- [ ] Upload bukti membuat status tagihan `pending`.
- [ ] Notifikasi proof pending diterima Admin.
- [ ] Notifikasi proof pending diterima Finance.
- [ ] Antrean Verifikasi dapat dibaca Admin dan Finance.
- [ ] Admin dapat approve bukti.
- [ ] Finance dapat reject bukti dengan alasan.
- [ ] Reject menghapus metadata file dan mengembalikan tagihan menjadi `unpaid`.

## F. Finance Transaction Safety
- [ ] Pembayaran Cash normal.
- [ ] Pembayaran QRIS normal.
- [ ] Pembayaran Transfer manual normal.
- [ ] Anti-double-payment menghasilkan HTTP 409 pada transaksi kedua.
- [ ] Nomor kwitansi memakai prefix sekolah.
- [ ] Void wajib alasan.
- [ ] Void mempertahankan ledger dan mengembalikan tagihan ke `unpaid`.
- [ ] Transaksi menggunakan row lock / server-first flow.

## G. Admin & Scale
- [ ] Dashboard Admin membaca PostgreSQL.
- [ ] Dashboard Finance membaca PostgreSQL.
- [ ] Student search/pagination server-side normal.
- [ ] Bill search/pagination server-side normal.
- [ ] SQL report summary normal.
- [ ] Export CSV server-side normal.
- [ ] Export XLSX server-side normal.
- [ ] Kelas/Wali Kelas/Jenis Pembayaran CRUD regression manual normal.
- [ ] Tagihan individual/massal regression manual normal.
- [ ] WA Reminder regression manual normal.

## H. Branding & Commercial Readiness
- [ ] Public branding endpoint normal.
- [ ] Admin dapat upload PNG/JPG/WebP <=2 MB.
- [ ] Logo tampil pada login/sidebar/kwitansi.
- [ ] Nama sekolah terisi.
- [ ] Tahun ajaran aktif terisi.
- [ ] Email support valid.
- [ ] Prefix kwitansi valid.
- [ ] Backup sukses <48 jam.
- [ ] Restore verification PASS.
- [ ] Commercial Readiness menunjukkan **100%**.

## Automated Final UAT coverage
`deploy/final-uat-v56.sh` menguji otomatis:
- runtime/lint/health/legacy API;
- backup + restore status/checksum;
- Admin/Finance/Parent login + CSRF;
- dashboard portal-state;
- multi-anak API + UI installation;
- aktivasi wali;
- private proof upload;
- staff notification;
- Admin approve + Finance reject;
- Cash/QRIS/Transfer;
- anti-double payment;
- receipt prefix;
- Void;
- receipt ACL;
- server pagination/search;
- laporan CSV/XLSX;
- maintenance/readiness;
- fatal/SQL errors baru di application log.

## Manual visual smoke setelah automated PASS
Tetap lakukan pemeriksaan visual singkat:
- [ ] Admin: Dashboard, Data Siswa, Akun Wali, Tagihan, Verifikasi, Laporan, Pengaturan Sekolah.
- [ ] Finance: Dashboard, Pembayaran, Verifikasi, Laporan, lonceng notifikasi.
- [ ] Wali: Dashboard mobile, pemilih anak, Tagihan Saya, Riwayat, Profil, lonceng notifikasi.

## Sign-off
Tanggal UAT: __________
Instance: `edupay.rumahsoftware.site`
Admin tester: __________
Finance tester: __________
Parent tester: __________

Hasil runner:
- PASS: __________
- WARN: __________
- FAIL: __________

Keputusan:
- [ ] **PASS** — `FAIL: 0`, `WARN: 0`, Commercial Readiness 100%; dapat lanjut Release Packaging V6.0.
- [ ] **CONDITIONAL PASS** — `FAIL: 0` tetapi masih ada WARN; selesaikan WARN sebelum label siap dijual.
- [ ] **FAIL** — ada satu atau lebih blocker; jangan dijual/clone.
