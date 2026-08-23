# EduPay — Go-Live & Commercial Readiness Checklist

Status audit: **MENUJU COMMERCIAL MASTER**. V5.3 sudah mengubah CRUD Admin utama menjadi server-first, tetapi release komersial masih menunggu security hardening, konsolidasi core, backup/restore production, dan UAT.

## P0 — Wajib sebelum produksi
- [x] PostgreSQL sebagai database operasional utama
- [x] Password production di-hash server-side
- [x] RBAC dasar Admin / Finance / Wali di backend
- [x] CRUD siswa server-first sejak V5.3
- [x] CRUD kelas/rombel server-first sejak V5.3
- [x] CRUD wali kelas server-first sejak V5.3
- [x] CRUD jenis pembayaran server-first sejak V5.3
- [x] Tagihan individual & massal server-first sejak V5.3
- [x] Import siswa server-first sejak V5.3
- [x] Import wali kelas server-first sejak V5.3
- [x] Pembayaran Cash / Transfer / QRIS server-first sejak V5.0
- [x] Upload bukti transfer tersimpan private di VPS sejak V5.1
- [x] Validasi file JPG/PNG/PDF, max 5 MB, random filename sejak V5.1
- [x] Admin/Finance dapat melihat file bukti asli sebelum approve/reject
- [x] Verifikasi bukti dapat dilakukan Admin dan Finance
- [x] Nomor kwitansi unik dibuat server-side
- [x] Void pembayaran menyimpan alasan + user + timestamp
- [x] Proteksi double-processing pembayaran dengan row lock PostgreSQL
- [x] Notifikasi in-app Wali, Admin dan Finance berbasis database
- [x] Aktivasi/reset password wali dengan token server
- [x] Logout/session expiry server-side
- [ ] CSRF protection untuk seluruh endpoint mutasi (V5.3 sudah aktif pada Admin Commercial Core; endpoint legacy masih perlu dikonsolidasi)
- [ ] Hapus seluruh demo credential/fallback auth lokal dari source runtime
- [ ] Session UI tidak boleh mengandalkan LocalStorage untuk authorization
- [ ] Security headers production lengkap
- [ ] Error logging terpusat tanpa data sensitif
- [ ] Audit log immutable/hardening untuk seluruh transaksi penting
- [ ] Backup database + proof storage otomatis terjadwal dan uji restore
- [ ] Isolasi data per sekolah / model deployment komersial final
- [ ] UAT seluruh role dan regression test

## P1 — Operasional sekolah
- [x] Master kelas/rombel editable
- [x] Master wali kelas editable
- [x] Import siswa Excel/CSV
- [x] Import wali kelas Excel/CSV
- [x] Tagihan per siswa / kelas / semua siswa
- [x] Filter dan pencarian tabel client-side
- [x] Reminder WhatsApp ke wali
- [x] Pengaturan identitas sekolah dasar sejak V5.3
- [x] Tahun ajaran & semester aktif pada profil sekolah sejak V5.3
- [ ] Kenaikan kelas / kelulusan / alumni
- [ ] Diskon/beasiswa/potongan
- [ ] Cicilan pembayaran
- [ ] Server-side pagination/search/filter untuk data besar
- [ ] Laporan penerimaan per tanggal/metode/kelas server-side
- [ ] Laporan tunggakan per siswa/kelas server-side
- [ ] Export Excel/PDF server-side
- [ ] Cetak kwitansi resmi dengan identitas/logo sekolah
- [ ] Upload logo sekolah dari panel (V5.3 sementara mendukung URL logo)
- [ ] Manajemen user Admin/Finance dari panel

## P2 — Commercial Master
- [x] Profil sekolah tanpa edit source: nama, NPSN, alamat, kontak, rekening, QRIS, tahun ajaran, semester, support email
- [ ] Konsolidasi frontend: hentikan pola banyak override file versi lama
- [ ] Konsolidasi API menjadi satu `/api/v1/*`
- [ ] Installer fresh deployment satu perintah
- [ ] Wizard onboarding sekolah baru production
- [ ] Pilihan model: single-instance per sekolah (disarankan untuk release awal)
- [ ] Backup/restore dari tool maintenance
- [ ] Monitoring uptime dan disk/database health
- [ ] Staging environment
- [ ] CI/CD + rollback release
- [ ] Manual Admin / Finance / Wali
- [ ] Terms of Service + Privacy Policy
- [ ] Versioning & release notes resmi
- [ ] UAT PASS + sign-off

## Progress versi

### V4.9 Stability
- [x] Snapshot PostgreSQL Admin/Finance
- [x] Polling dan refresh saat tab kembali aktif
- [x] Delta sync transition layer
- [x] Indikator status VPS

### V5.0 Finance Transaction Safety
- [x] Approve/reject server-first
- [x] Payment server-first
- [x] Row locking anti double payment
- [x] Receipt server-side
- [x] Void server-side + reason
- [x] Riwayat wali dari payment ledger

### V5.1 Proof Storage
- [x] File bukti private VPS
- [x] MIME/size validation
- [x] Viewer untuk Admin/Finance

### V5.2 Staff Operations
- [x] Verifikasi bukti Admin + Finance
- [x] WA Reminder
- [x] Notifikasi Admin/Finance
- [x] Menu Migrasi disembunyikan dari operasional

### V5.3 Commercial Core
- [x] CRUD Siswa server-first
- [x] CRUD Kelas server-first
- [x] CRUD Wali Kelas server-first
- [x] CRUD Jenis Pembayaran server-first
- [x] Tagihan individual/massal server-first
- [x] Import siswa/wali kelas server-first
- [x] CSRF untuk endpoint Admin V5.3
- [x] Pengaturan Sekolah di PostgreSQL
- [x] LocalStorage Admin diposisikan sebagai cache, bukan sumber mutasi

## Berikutnya
1. **V5.4 Security & Core Consolidation** — CSRF seluruh mutation endpoint, hapus demo auth/local fallback, security headers, centralized error handling, mulai `/api/v1`.
2. **V5.5 Reports & Scale** — server-side reports, pagination/search, export, dashboard queries untuk data besar.
3. **V5.6 Backup/Restore & Branding** — scheduled backup DB+proofs, restore test, logo upload, kwitansi resmi.
4. **V6.0 Commercial Master** — installer/onboarding, staging, CI/CD, UAT, documentation, release packaging.
