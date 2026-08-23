# EduPay Commercial Master Roadmap

Target akhir: **EduPay V6.0 Commercial Master Release** — master instalasi pembayaran sekolah yang aman, stabil, dapat di-branding, mudah dipasang ulang, dan siap diuji pada sekolah baru.

## Prinsip arsitektur
1. PostgreSQL adalah source of truth.
2. LocalStorage hanya boleh menjadi cache UI, bukan sumber authorization atau transaksi.
3. Semua mutasi penting harus server-first dan menghasilkan audit log.
4. Finance mutation harus atomic dan idempotent.
5. Bukti pembayaran disimpan private.
6. Release awal komersial menggunakan model **1 sekolah = 1 instance + 1 database**.
7. Source tidak diedit per sekolah; branding dan profil sekolah diatur dari panel.

## V5.3 — Commercial Core
Status: **IMPLEMENTED / UAT berkelanjutan**
- Server-first siswa, kelas, wali kelas, jenis pembayaran, tagihan.
- Import siswa/wali kelas server-first.
- Pengaturan identitas sekolah, akademik, rekening, QRIS, support.

## V5.4 — Security & Core Consolidation
Status: **IMPLEMENTED / UAT berkelanjutan**
- Public API router `/api/v1/*`.
- Global CSRF untuk mutation production.
- Server-authoritative session.
- Demo credential/runtime dihapus.
- Security headers, request ID, centralized error log.
- Legacy direct API ditutup.

## V5.5 — Reports & Scale
Status: **IMPLEMENTED + HOTFIX V5.5.2 / UAT VPS**
- Server pagination/search/filter siswa, akun wali, tagihan, pembayaran.
- SQL dashboard dan SQL reports.
- CSV/XLSX server export.
- Index PostgreSQL untuk skala besar.
- Unified portal-state Admin/Finance/Wali.
- Schema compatibility repair untuk instalasi yang berkembang dari versi lama.

## V5.6 — Backup, Branding & Official Documents
Status: **IMPLEMENTED / menunggu deployment + UAT sign-off**
- Backup PostgreSQL terjadwal harian dengan systemd timer.
- Backup private proof storage dan branding pada backup yang sama.
- Retention configurable 7-365 hari.
- SHA256 backup manifest.
- Restore verification ke database sementara tanpa menyentuh produksi.
- Status backup dan restore tampil di Pengaturan Sekolah.
- Logo sekolah di-upload ke private controlled storage dan disajikan melalui API.
- Branding nama aplikasi/sekolah diterapkan ke login/sidebar.
- Kwitansi resmi berbasis ledger PostgreSQL dengan identitas sekolah.
- Prefix nomor kwitansi configurable dan digunakan untuk transaksi baru.
- Footer kwitansi configurable.
- Commercial Readiness score di panel Admin.
- Fresh `backend/schema.sql` diselaraskan dengan struktur Commercial Master.

Exit criteria V5.6:
- Daily backup timer aktif.
- Backup pertama PASS.
- Restore rehearsal PASS.
- Logo dapat di-upload dan muncul pada UI/kwitansi.
- Pembayaran baru memakai prefix kwitansi yang diatur sekolah.
- Wali hanya dapat membuka kwitansi siswa yang terhubung dengan akunnya.
- Commercial Readiness wajib mencapai 100% sebelum source dikloning untuk pelanggan.

## V5.7 — School Lifecycle
Status: **OPTIONAL NEXT PRODUCT PHASE**
- Tahun ajaran/semester records.
- Kenaikan kelas massal.
- Alumni/kelulusan.
- Arsip tahun ajaran.
- Proteksi historical financial data saat promosi kelas.

## V6.0 — Commercial Master Release
Status: **RELEASE PACKAGING / setelah UAT V5.6 PASS**
- Fresh installer one-command.
- School onboarding wizard.
- Environment preflight.
- Release/rollback script.
- Smoke/UAT Admin-Finance-Wali.
- Manual pengguna final.
- Privacy Policy / Terms template.
- Release notes + semantic version tag.
- Production checklist sign-off.

## Model penjualan release awal
Disarankan:
- 1 sekolah = 1 instance EduPay
- 1 subdomain/domain sekolah
- 1 PostgreSQL database per sekolah
- 1 private proof/branding storage per instance
- update source menggunakan release tag yang sama

Keuntungan: isolasi data lebih sederhana, risiko tenant leakage lebih rendah, deployment/support lebih mudah dibanding SaaS multi-tenant pada release pertama.
