# EduPay — Go-Live & Commercial Readiness Checklist

Status audit: **BELUM SIAP DIJUAL / BELUM SIAP PRODUKSI** sampai seluruh item P0 selesai.

## P0 — Wajib sebelum produksi
- [ ] Backend server-side (bukan LocalStorage)
- [ ] Database PostgreSQL/MySQL
- [ ] Password di-hash (Argon2id/bcrypt), tidak disimpan plaintext
- [ ] Session/auth server-side + CSRF protection
- [ ] RBAC Admin / Finance / Wali di backend
- [ ] Isolasi data per sekolah (multi-tenant) jika dijual ke banyak sekolah
- [ ] CRUD siswa tersimpan ke database
- [ ] CRUD kelas/rombel tersimpan ke database
- [ ] CRUD jenis pembayaran tersimpan ke database
- [ ] Tagihan individual & massal tersimpan ke database
- [ ] Pembayaran cash/transfer/QRIS tersimpan ke database
- [ ] Upload bukti transfer benar-benar tersimpan di server/object storage
- [ ] Validasi ukuran/jenis file upload + random filename
- [ ] Finance dapat melihat bukti transfer asli sebelum approve/reject
- [ ] Nomor kwitansi unik dan dibuat server-side
- [ ] Pembatalan/void pembayaran wajib menyimpan alasan + user + timestamp
- [ ] Audit log immutable untuk transaksi keuangan
- [ ] Proteksi perubahan tagihan yang sudah lunas
- [ ] Backup database otomatis + uji restore
- [ ] HTTPS aktif dan security headers
- [ ] Rate limiting login
- [ ] Reset password aman
- [ ] Logout/session expiry
- [ ] Error logging tanpa membocorkan data sensitif
- [ ] UAT seluruh role

## P1 — Wajib untuk operasional sekolah yang baik
- [ ] Tahun ajaran & semester
- [ ] Master kelas/rombel editable
- [ ] Import siswa Excel/CSV
- [ ] Kenaikan kelas / kelulusan / alumni
- [ ] Diskon/beasiswa/potongan
- [ ] Cicilan pembayaran
- [ ] Tagihan per kelas/angkatan/siswa
- [ ] Filter dan pencarian pada tabel
- [ ] Laporan penerimaan per tanggal/metode/kelas
- [ ] Laporan tunggakan per siswa/kelas
- [ ] Export Excel/PDF
- [ ] Cetak kwitansi resmi dengan identitas sekolah
- [ ] Pengaturan profil sekolah, logo, alamat, rekening/QRIS
- [ ] Manajemen user dan role
- [ ] Notifikasi pembayaran/tagihan (opsional WhatsApp/email)

## P2 — Commercial readiness
- [ ] Setup wizard sekolah baru
- [ ] Multi-tenant/subdomain per sekolah
- [ ] Paket berlangganan/lisensi
- [ ] Branding/custom logo sekolah
- [ ] Terms of Service + Privacy Policy
- [ ] Backup/restore dari panel owner
- [ ] Monitoring uptime
- [ ] Health check
- [ ] Staging environment
- [ ] CI/CD dan rollback
- [ ] Manual pengguna Admin/Finance/Wali
- [ ] SLA/support process

## Fitur prototype V3.3 yang sudah dibuat
- [x] UI responsive 3 portal
- [x] Sidebar professional + ikon menu
- [x] Dashboard cards
- [x] CRUD siswa pada prototype LocalStorage
- [x] CRUD jenis pembayaran pada prototype LocalStorage
- [x] Tagihan individual pada prototype LocalStorage
- [x] Tagihan massal pada prototype LocalStorage
- [x] Nonaktifkan/aktifkan siswa dan jenis pembayaran
- [x] Void transaksi prototype
- [x] Upload bukti transfer UI prototype
- [x] Verifikasi bukti transfer UI prototype
- [x] Export CSV dasar
- [x] HTTPS/domain prototype

> Catatan: fitur yang bertanda prototype belum dianggap production-ready sampai dipindahkan ke backend/database dan memiliki validasi serta audit trail server-side.
