# EduPay — Go-Live & Commercial Readiness Checklist

Status audit: **BELUM SIAP DIJUAL / BELUM SIAP PRODUKSI** sampai seluruh item P0 selesai.

## P0 — Wajib sebelum produksi
- [ ] Backend server-side penuh (Admin CRUD masih transisi cache LocalStorage → PostgreSQL)
- [x] Database PostgreSQL
- [x] Password production di-hash server-side
- [ ] Session/auth server-side + CSRF protection (session sudah server-side; CSRF belum)
- [x] RBAC dasar Admin / Finance / Wali di backend
- [ ] Isolasi data per sekolah (multi-tenant) jika dijual ke banyak sekolah
- [ ] CRUD siswa server-first
- [ ] CRUD kelas/rombel server-first
- [ ] CRUD jenis pembayaran server-first
- [ ] Tagihan individual & massal server-first
- [x] Pembayaran Cash / Transfer / QRIS dicatat server-first sejak V5.0
- [ ] Upload bukti transfer benar-benar tersimpan di server/object storage
- [ ] Validasi ukuran/jenis file upload + random filename
- [ ] Finance dapat melihat file bukti transfer asli sebelum approve/reject
- [x] Nomor kwitansi unik dibuat server-side sejak V5.0
- [x] Void pembayaran menyimpan alasan + user + timestamp sejak V5.0
- [ ] Audit log immutable untuk seluruh transaksi keuangan (event payment/reject/void sudah dicatat; hardening masih perlu)
- [x] Proteksi double-processing pembayaran dengan row lock PostgreSQL
- [x] Proteksi perubahan pembayaran lunas pada endpoint Finance V5.0
- [ ] Backup database otomatis terjadwal + uji restore (backup pre-upgrade sudah tersedia)
- [ ] HTTPS aktif dan security headers (HTTPS aktif; headers hardening belum lengkap)
- [x] Rate limiting/lockout login dasar
- [x] Reset password wali dengan token server
- [x] Logout/session expiry server-side
- [ ] Error logging terpusat tanpa membocorkan data sensitif
- [ ] UAT seluruh role

## P1 — Wajib untuk operasional sekolah yang baik
- [ ] Tahun ajaran & semester aktif
- [x] Master kelas/rombel editable
- [x] Import siswa Excel/CSV
- [x] Import wali kelas Excel/CSV
- [ ] Kenaikan kelas / kelulusan / alumni
- [ ] Diskon/beasiswa/potongan
- [ ] Cicilan pembayaran
- [x] Tagihan per kelas/semua siswa/siswa individual pada UI operasional
- [x] Filter dan pencarian pada tabel
- [ ] Server-side pagination/search untuk data besar
- [ ] Laporan penerimaan per tanggal/metode/kelas server-side
- [ ] Laporan tunggakan per siswa/kelas server-side
- [ ] Export Excel/PDF server-side
- [ ] Cetak kwitansi resmi dengan identitas sekolah
- [ ] Pengaturan profil sekolah, logo, alamat, rekening/QRIS
- [ ] Manajemen user dan role
- [x] Notifikasi in-app wali berbasis database/polling

## P2 — Commercial readiness
- [ ] Setup wizard sekolah baru production
- [ ] Multi-tenant/subdomain per sekolah
- [ ] Paket berlangganan/lisensi
- [ ] Branding/custom logo sekolah
- [ ] Terms of Service + Privacy Policy
- [ ] Backup/restore dari panel owner
- [ ] Monitoring uptime
- [x] Health check backend
- [ ] Staging environment
- [ ] CI/CD dan rollback
- [ ] Manual pengguna Admin/Finance/Wali
- [ ] SLA/support process

## Progress versi

### V4.9 Stability
- [x] Snapshot PostgreSQL Admin/Finance
- [x] Polling dan refresh saat tab kembali aktif
- [x] Delta sync untuk mencegah cache lama menimpa perubahan server
- [x] Indikator VPS tersinkron / gagal sinkron

### V5.0 Finance Transaction Safety
- [x] Approve pembayaran server-first
- [x] Reject bukti server-first + alasan wajib
- [x] Pembayaran manual Cash/Transfer/QRIS server-first
- [x] Row locking mencegah double payment
- [x] Nomor kwitansi dibuat server per hari
- [x] Void server-first + alasan + user + timestamp
- [x] Riwayat wali membaca ledger pembayaran server
- [x] Notifikasi wali untuk payment/reject/void

## Berikutnya
1. **V5.1 Proof Storage** — simpan file JPG/PNG/PDF asli secara private di VPS.
2. **V5.2 Admin Server CRUD** — siswa/kelas/fee/tagihan langsung API tanpa local-first.
3. **V5.3 Security Hardening** — CSRF, headers, hapus demo credential/fallback lokal, error logging.
4. **V6.0 Commercial** — multi-tenant, onboarding sekolah, backup/restore, UAT, CI/CD.
