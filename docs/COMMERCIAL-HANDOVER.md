# EduPay Commercial Handover Checklist

Gunakan dokumen ini untuk setiap sekolah baru.

## 1. Server & Domain
- Ubuntu 22.04/24.04
- Domain/subdomain sudah mengarah ke IP VPS
- HTTPS aktif
- Waktu server/NTP benar
- Port 80/443 terbuka

## 2. Install Master
Jalankan `deploy/install-commercial-master.sh` dengan domain, school code, school name, password Admin/Finance, support email, dan tahun ajaran.

Setelah instalasi:
- `/api/v1/health` harus `ok:true`
- direct legacy `/api/*` selain v1 harus tertutup
- backup timer aktif
- restore rehearsal PASS

## 3. Profil Sekolah
Admin → Pengaturan Sekolah:
- Nama sekolah
- NPSN
- Alamat
- Telepon/email
- Kepala sekolah
- Bendahara
- Tahun ajaran/semester
- Rekening bank
- QRIS
- Support email
- Logo
- Prefix/footer kwitansi

## 4. Master Akademik
- Kelas
- Wali kelas
- Data siswa
- Nama wali
- Nomor HP wali
- Jenis pembayaran

Import Excel wajib diperiksa preview/validasinya sebelum commit.

## 5. Akun Wali
- Perbarui/sinkron relasi wali
- Buat undangan
- Uji aktivasi dari perangkat berbeda
- Uji akun multi-anak bila ada

## 6. Finance
- Uji Cash
- Uji Transfer
- Uji QRIS
- Uji upload bukti
- Uji approve Admin
- Uji approve/reject Finance
- Uji anti double-payment
- Uji Void dengan alasan
- Uji kwitansi

## 7. Laporan
- Dashboard sesuai PostgreSQL
- Laporan penerimaan
- Laporan tunggakan
- Filter tanggal/kelas/metode
- CSV
- XLSX
- WA reminder

## 8. Backup & Recovery
- `edupay-backup.timer` aktif
- backup pertama PASS
- checksum PASS
- restore rehearsal PASS
- lokasi backup dicatat
- kebijakan retensi disetujui sekolah

## 9. Final UAT

```bash
sudo /var/www/edupay/deploy/final-uat-v56.sh
```

Target:
- `FAIL: 0`
- `WARN: 0`
- Commercial Readiness `100%`

Kemudian:

```bash
sudo /var/www/edupay/deploy/release-gate-v60.sh
```

Harus menghasilkan `RELEASE GATE PASS`.

## 10. Serah Terima
Catat:
- Domain
- Tanggal go-live
- Versi release
- Commit Git
- Nama teknisi
- PIC sekolah
- Lokasi backup
- Akun Admin diserahkan melalui kanal aman
- Password awal Finance diganti oleh sekolah
- Kebijakan support/SLA disepakati

Jangan mencantumkan password pada dokumen serah terima yang dibagikan umum.
