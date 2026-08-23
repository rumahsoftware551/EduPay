# UAT EduPay V5.6 Commercial Master

Status awal: **BELUM SIGN-OFF**. UAT ini wajib PASS sebelum source diberi label siap dijual.

## A. Deployment & Health
- [ ] `deploy/upgrade-v56.sh` selesai sampai `[9/9]`.
- [ ] `/api/v1/health` menampilkan `version: 5.6` dan `commercial_master: true`.
- [ ] Direct legacy `/api/v56/health` menghasilkan HTTP 404.
- [ ] Tidak ada PHP fatal error baru pada `/var/log/edupay/app.log`.

## B. Backup & Restore
- [ ] `edupay-backup.timer` aktif.
- [ ] Backup pertama menghasilkan `database.sql.gz`, `proofs.tar.gz`, `branding.tar.gz`, `manifest.sha256`.
- [ ] `backup-status.json` berstatus `ok:true`.
- [ ] Restore rehearsal ke database sementara PASS.
- [ ] `restore-status.json` berstatus `ok:true`.
- [ ] Database produksi tidak berubah selama restore rehearsal.

## C. Branding
- [ ] Admin dapat upload PNG/JPG/WebP <= 2 MB.
- [ ] Logo tampil di login.
- [ ] Logo tampil di sidebar.
- [ ] Nama aplikasi/nama sekolah mengikuti Pengaturan Sekolah.
- [ ] Logo tampil pada kwitansi resmi.

## D. Kwitansi
- [ ] Admin dapat mengubah prefix kwitansi.
- [ ] Pembayaran baru Finance memakai prefix baru.
- [ ] Approve bukti oleh Admin memakai prefix baru.
- [ ] Approve bukti oleh Finance memakai prefix baru.
- [ ] Kwitansi memuat sekolah, siswa, kelas, tagihan, metode, nominal, waktu, petugas.
- [ ] Kwitansi VOID menampilkan status/alasan VOID.
- [ ] Parent tidak dapat membuka kwitansi milik siswa lain.

## E. Admin Regression
- [ ] Dashboard membaca PostgreSQL.
- [ ] Data Siswa pagination/search normal.
- [ ] Akun Wali normal.
- [ ] Kelas/Wali Kelas/Jenis Pembayaran CRUD normal.
- [ ] Tagihan individual/massal normal.
- [ ] Verifikasi Bukti normal.
- [ ] Notifikasi staff normal.
- [ ] WA Reminder normal.
- [ ] Laporan + CSV/XLSX normal.
- [ ] Pengaturan Sekolah + panel Commercial Master normal.

## F. Finance Regression
- [ ] Dashboard membaca PostgreSQL.
- [ ] Pembayaran Cash normal.
- [ ] Pembayaran Transfer normal.
- [ ] Pembayaran QRIS normal.
- [ ] Anti double-payment tetap bekerja.
- [ ] Approve/Reject proof normal.
- [ ] Void wajib alasan dan normal.
- [ ] Kwitansi resmi dapat dibuka.
- [ ] Notifikasi staff normal.

## G. Parent Regression
- [ ] Login/aktivasi akun normal.
- [ ] Beranda membaca PostgreSQL.
- [ ] Multi-anak tetap bekerja.
- [ ] Tagihan Saya normal.
- [ ] Upload bukti private normal.
- [ ] Notifikasi normal.
- [ ] Riwayat pembayaran normal.
- [ ] Kwitansi resmi hanya milik anak terhubung.

## H. Commercial Readiness
- [ ] Nama sekolah terisi.
- [ ] Tahun ajaran aktif terisi.
- [ ] Email support valid.
- [ ] Prefix kwitansi valid.
- [ ] Backup < 48 jam PASS.
- [ ] Restore verification PASS.
- [ ] Commercial Readiness panel menunjukkan **100%**.

## Sign-off
Tanggal UAT: __________
Sekolah/Instance: __________
Admin tester: __________
Finance tester: __________
Parent tester: __________

Keputusan:
- [ ] PASS — dapat lanjut Release Packaging V6.0.
- [ ] FAIL — catat issue dan jangan dijual/clone sampai blocker selesai.
