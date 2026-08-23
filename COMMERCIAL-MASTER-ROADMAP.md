# EduPay Commercial Master Roadmap

Target akhir: **EduPay V6.0 Commercial Master** — master instalasi pembayaran sekolah yang aman, stabil, dapat di-branding, mudah dipasang ulang, dan siap diuji pada sekolah baru.

## Prinsip arsitektur
1. PostgreSQL adalah source of truth.
2. LocalStorage hanya boleh menjadi cache UI, bukan sumber authorization atau transaksi.
3. Semua mutasi penting harus server-first dan menghasilkan audit log.
4. Finance mutation harus atomic dan idempotent.
5. Bukti pembayaran disimpan private.
6. Release awal komersial menggunakan model **1 sekolah = 1 instance + 1 database** agar isolasi data sederhana dan kuat.
7. Source tidak diedit per sekolah; branding dan profil sekolah diatur dari panel.

## V5.3 — Commercial Core
Status: **IMPLEMENTED / perlu deployment & UAT**
- Server-first siswa, kelas, wali kelas, jenis pembayaran, tagihan.
- Import siswa/wali kelas server-first.
- CSRF khusus Commercial Admin API.
- Pengaturan Sekolah: identitas, akademik aktif, rekening, QRIS, support.

Exit criteria:
- Perubahan Admin dari browser A langsung terlihat konsisten di browser B setelah refresh.
- Tidak ada CRUD Admin utama yang perlu push LocalStorage ke VPS.
- Tagihan massal dicegah duplikat dari sisi database/API.

## V5.4 — Security & Core Consolidation
- Satu API router `/api/v1/*`.
- CSRF untuk seluruh POST/PUT/PATCH/DELETE.
- Hapus demo credential dan auth fallback lokal.
- Session bootstrap selalu dari server `/auth/me`.
- CSP, HSTS, frame-ancestors, permissions policy.
- Central error handler + server log.
- Request ID untuk audit/troubleshooting.
- Reorganisasi frontend ke satu runtime core; file versi lama menjadi compatibility-only lalu dihapus bertahap.

Exit criteria:
- Tidak ada mutation production yang tidak memakai CSRF.
- Tidak ada password demo pada runtime UI.
- Authorization tidak pernah ditentukan oleh LocalStorage.

## V5.5 — Reports & Scale
- Server-side pagination/search/filter untuk siswa, tagihan, payment, guardian.
- Dashboard aggregate SQL.
- Laporan penerimaan per tanggal/metode/kelas.
- Laporan tunggakan per kelas/siswa.
- Export CSV/XLSX server-side.
- Query index review untuk 10.000+ siswa.

Exit criteria:
- Dataset besar tidak dikirim penuh ke browser.
- Filter/pagination konsisten antar browser.

## V5.6 — Backup, Branding & Documents
- Scheduled PostgreSQL backup.
- Scheduled backup private proof storage.
- Retention policy.
- Restore verification script.
- Upload logo sekolah private/public asset controlled.
- Kwitansi resmi dengan identitas sekolah.
- Nomor dokumen/receipt configurable.
- Backup status pada maintenance health.

Exit criteria:
- Restore rehearsal berhasil ke database baru.
- Kwitansi dapat digunakan tanpa edit source.

## V5.7 — School Lifecycle
- Tahun ajaran/semester records.
- Kenaikan kelas massal.
- Alumni/kelulusan.
- Arsip tahun ajaran.
- Prevent historical financial data from being rewritten during class promotion.

## V6.0 — Commercial Master Release
- Fresh installer one-command.
- School onboarding wizard.
- Environment preflight.
- Staging mode.
- Release/rollback scripts.
- Smoke tests.
- UAT Admin/Finance/Wali.
- Manual pengguna.
- Privacy Policy / Terms template.
- Release notes + semantic version.
- Production checklist sign-off.

## Model penjualan release awal
Disarankan:
- 1 sekolah = 1 instance EduPay
- 1 subdomain/domain sekolah
- 1 PostgreSQL database per sekolah
- 1 private proof storage per instance
- update source menggunakan release tag yang sama

Keuntungan: isolasi data lebih sederhana, risiko tenant leakage lebih rendah, deployment/support lebih mudah dibanding SaaS multi-tenant pada release pertama.
