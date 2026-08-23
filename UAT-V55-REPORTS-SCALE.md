# EduPay V5.5 — UAT Reports & Scale

Status awal: **belum diuji di VPS production**.

## 1. Health & Runtime
- [ ] `/api/v1/health` mengembalikan `version=5.5` dan `reports_scale=true`.
- [ ] Halaman dibuka dengan `?v=55` tanpa error console fatal.
- [ ] Login Admin, Finance, dan Wali tetap normal.
- [ ] Aktivasi Akun Wali V5.4.1 tetap tampil pada login.
- [ ] Direct legacy API `/api/v49/state` tetap HTTP 404.

## 2. Dashboard SQL
- [ ] Admin dashboard tampil tanpa memuat seluruh dataset ke browser.
- [ ] Finance dashboard tampil.
- [ ] Total Tagihan sesuai database.
- [ ] Sudah Dibayar sesuai database.
- [ ] Belum Dibayar sesuai database.
- [ ] Perlu Verifikasi sesuai antrean bukti.
- [ ] Penerimaan Hari Ini benar.
- [ ] Penerimaan Bulan Ini benar.
- [ ] 5 transaksi terbaru benar.

## 3. Data Siswa — Server Pagination
- [ ] Default hanya memuat 25 data.
- [ ] Pilihan 10/25/50/100 per halaman bekerja.
- [ ] Next/Previous bekerja.
- [ ] Cari berdasarkan nama bekerja.
- [ ] Cari berdasarkan NIS bekerja.
- [ ] Cari nama wali/nomor HP bekerja.
- [ ] Filter kelas bekerja.
- [ ] Filter aktif/nonaktif bekerja.
- [ ] Tambah siswa tetap server-first.
- [ ] Edit siswa tetap server-first.
- [ ] Import Excel tetap bekerja.
- [ ] Browser Admin kedua melihat perubahan yang sama.

## 4. Akun Wali — Server Pagination
- [ ] Pagination bekerja.
- [ ] Search nama/nomor HP/nama anak bekerja.
- [ ] Filter status bekerja.
- [ ] Sapaan bekerja.
- [ ] Buat/Kirim ulang undangan bekerja.
- [ ] Reset akses bekerja.
- [ ] Nonaktif/Aktifkan bekerja.
- [ ] Perbarui Relasi Wali tidak mengirim full browser snapshot.

## 5. Tagihan — Server Pagination
- [ ] Pagination bekerja.
- [ ] Search siswa/NIS/tagihan bekerja.
- [ ] Filter kelas/status bekerja.
- [ ] Filter jatuh tempo bekerja.
- [ ] Tambah tagihan mencari siswa secara server-side.
- [ ] Edit tagihan bekerja.
- [ ] Buat massal bekerja.
- [ ] Batalkan/Pulihkan bekerja.
- [ ] WA Reminder membuka nomor wali yang benar.
- [ ] Tagihan pending diarahkan ke Verifikasi, bukan diedit sembarangan.

## 6. Finance / Payment Ledger
- [ ] Finance mencari tagihan belum bayar tanpa dropdown seluruh siswa.
- [ ] Cash bekerja.
- [ ] QRIS bekerja.
- [ ] Transfer manual bekerja sesuai aturan.
- [ ] Pagination ledger bekerja.
- [ ] Search kwitansi/siswa/NIS/tagihan bekerja.
- [ ] Filter metode bekerja.
- [ ] Filter tanggal bekerja.
- [ ] Filter valid/void bekerja.
- [ ] Void tetap wajib alasan dan langsung memperbarui server.

## 7. Laporan
- [ ] Ringkasan penerimaan sesuai transaksi valid.
- [ ] Ringkasan tunggakan sesuai tagihan unpaid/pending.
- [ ] Filter tanggal bekerja.
- [ ] Filter kelas bekerja.
- [ ] Filter metode bekerja.
- [ ] Opsi hanya tunggakan lewat jatuh tempo bekerja.
- [ ] Detail penerimaan dipaginasi server-side.
- [ ] Detail tunggakan dipaginasi server-side.
- [ ] WA pada tunggakan bekerja.

## 8. Export
- [ ] Penerimaan CSV berhasil diunduh dan dibuka.
- [ ] Penerimaan XLSX berhasil diunduh dan dibuka di Excel/LibreOffice.
- [ ] Tunggakan CSV berhasil.
- [ ] Tunggakan XLSX berhasil.
- [ ] Isi export mengikuti filter aktif.
- [ ] Nominal tidak berubah menjadi teks yang salah.

## 9. Scale / Regression
- [ ] Tidak ada pagination client V4.5 ganda pada halaman server-side.
- [ ] LocalStorage staff tidak menyimpan >100 siswa/tagihan/payment setelah V5.5 aktif.
- [ ] Pindah halaman tidak menyebabkan full dataset download.
- [ ] Polling notifikasi Admin/Finance tetap bekerja.
- [ ] Verifikasi bukti Admin/Finance tetap bekerja.
- [ ] Portal Wali tetap server-first dan tidak terdampak pagination staff.

## Exit Criteria V5.5
Semua item kritis pada bagian 1–8 PASS dan tidak ada regression P0 pada transaksi pembayaran. Setelah itu V5.5 dapat ditandai **UAT PASS** dan project lanjut ke V5.6 Backup, Branding & Documents.
