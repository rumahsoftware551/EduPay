# EduPay V6.0 Commercial Master Candidate

## Status
**RC — belum boleh diberi label stable sampai Final UAT live PASS tanpa warning.**

## Release gate wajib

```bash
cd /var/www/edupay
chmod +x deploy/release-gate-v60.sh
sudo ./deploy/release-gate-v60.sh
```

Release hanya boleh dilanjutkan jika output berakhir dengan:

```text
RELEASE GATE PASS
```

Runner di dalam gate mensyaratkan:
- Final UAT `FAIL: 0`
- Final UAT `WARN: 0`
- API `commercial_master:true`
- manifest checksum berhasil dibuat

## Scope Commercial Master
- PostgreSQL sebagai source of truth
- Admin / Finance / Parent server session
- CSRF gateway `/api/v1`
- private proof storage
- Admin/Finance verification
- atomic payment + receipt counter
- Void + audit
- server-side pagination/reporting
- CSV/XLSX export
- school branding/logo
- official receipt
- backup + restore rehearsal
- multi-child parent portal
- staff/parent notifications
- WA reminder
- fresh-school installer
- sanitized release package builder

## Fresh installation
Gunakan `deploy/install-commercial-master.sh`. Jangan gunakan setup prototype/LocalStorage untuk sekolah baru.

## Package builder

```bash
chmod +x deploy/package-release-v60.sh
sudo ./deploy/package-release-v60.sh
```

Package builder akan menjalankan release gate terlebih dahulu kecuali operator secara eksplisit memakai `EDUPAY_SKIP_GATE=1`. Opsi bypass tersebut hanya untuk debugging internal dan tidak boleh digunakan untuk paket yang dijual.

## Data yang tidak boleh masuk package
- `backend/config.php`
- database dump sekolah
- bukti transfer
- logo/data pelanggan yang tidak dilisensikan
- password/bootstrap key
- `.env*`
- log production

## Model deployment yang direkomendasikan
**1 sekolah = 1 instance + 1 database PostgreSQL.**

Multi-tenant SaaS bukan scope V6.0 Commercial Master pertama.
