# EduPay School Finance — Commercial Master

EduPay adalah aplikasi pembayaran sekolah berbasis web dengan tiga portal: **Administrator**, **Finance/Bendahara**, dan **Orang Tua/Wali**.

## Status release

Baseline saat ini: **V6.0 Commercial Master Candidate**. Source tidak boleh diberi label `stable/sale-ready` sebelum Final UAT live menghasilkan **FAIL: 0** dan Commercial Readiness **100%**.

## Arsitektur production

- Frontend: HTML/CSS/JavaScript PWA
- Backend: PHP-FPM
- Database: PostgreSQL
- Web server: Nginx
- Session: server-side, secure HttpOnly cookie
- API production: `/api/v1/*`
- Bukti transfer: private storage VPS (`/var/lib/edupay/proofs`)
- Branding: private storage VPS (`/var/lib/edupay/branding`)
- Backup: PostgreSQL + proof + branding, systemd timer
- Audit: PostgreSQL audit log + request ID log `/var/log/edupay/app.log`

Tidak ada akun demo production dan autentikasi tidak memakai LocalStorage sebagai sumber otoritas.

## Fitur utama

### Administrator
- Dashboard PostgreSQL
- Data siswa + import Excel
- Akun wali + aktivasi/reset akses
- Kelas dan wali kelas
- Jenis pembayaran
- Tagihan individual dan massal
- Verifikasi bukti transfer
- Notifikasi staff
- WA reminder wali
- Laporan penerimaan/tunggakan + CSV/XLSX
- Pengaturan sekolah, branding, kwitansi, backup/readiness

### Finance
- Dashboard PostgreSQL
- Cash / Transfer / QRIS
- Verifikasi bukti
- Anti double-payment
- Void dengan alasan
- Kwitansi resmi
- Notifikasi staff
- Laporan

### Orang Tua/Wali
- Aktivasi akun sendiri
- Multi-anak
- Tagihan realtime dari PostgreSQL
- Upload bukti JPG/PNG/PDF private
- Notifikasi
- Riwayat pembayaran
- Kwitansi resmi dengan pembatasan akses siswa terhubung

## Instalasi sekolah baru

Untuk instance baru, siapkan Ubuntu 22.04/24.04, domain yang sudah mengarah ke VPS, lalu letakkan source di `/var/www/edupay`.

Jalankan installer Commercial Master:

```bash
cd /var/www/edupay
chmod +x deploy/install-commercial-master.sh
sudo EDUPAY_DOMAIN=bayar.sekolah.sch.id \
  EDUPAY_SCHOOL_CODE=sekolah-utama \
  EDUPAY_SCHOOL_NAME="Nama Sekolah" \
  EDUPAY_ADMIN_PASSWORD='GantiPasswordAdmin9A!' \
  EDUPAY_FINANCE_PASSWORD='GantiPasswordFinance9A!' \
  EDUPAY_SUPPORT_EMAIL='support@sekolah.sch.id' \
  ./deploy/install-commercial-master.sh
```

Installer tidak akan mengaktifkan SSL otomatis kecuali `EDUPAY_ENABLE_SSL=1`. Pastikan DNS sudah benar sebelum meminta sertifikat Let's Encrypt.

## Upgrade instance existing

Gunakan script upgrade sesuai versi terakhir. Untuk baseline V5.6/V5.6.1:

```bash
cd /var/www/edupay
git fetch origin main
git reset --hard origin/main
chmod +x deploy/upgrade-v561.sh deploy/final-uat-v56.sh
sudo ./deploy/upgrade-v561.sh
```

## Final UAT

Final UAT wajib dijalankan pada instance production candidate:

```bash
sudo /var/www/edupay/deploy/final-uat-v56.sh
```

Target release gate:

```text
FAIL: 0
WARN: 0
Commercial Readiness: 100%
```

Jika `FAIL > 0`, instance **tidak boleh** dijual/clone sebagai master stable.

## Backup & restore

Backup otomatis menggunakan `edupay-backup.timer`. Backup berisi database, bukti transfer, branding, checksum, dan metadata.

```bash
systemctl list-timers edupay-backup.timer
sudo /var/www/edupay/deploy/backup-edupay.sh
sudo /var/www/edupay/deploy/verify-restore.sh
```

## Model komersial yang disarankan

Tahap awal: **1 sekolah = 1 instance + 1 database**. Model ini lebih mudah diisolasi, di-backup, dan dipelihara dibanding langsung memakai multi-tenant SaaS.

## Release policy

- Jangan simpan `backend/config.php`, password, bootstrap key, atau backup production ke Git.
- Jangan memasukkan data siswa nyata ke package master.
- Tag/release stable hanya setelah Final UAT PASS.
- Simpan changelog, manifest release, dan checksum package untuk setiap instalasi pelanggan.

Dokumen tambahan tersedia di `docs/` dan checklist UAT di `UAT-V56-COMMERCIAL-MASTER.md`.
