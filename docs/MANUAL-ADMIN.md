# Manual Administrator EduPay

## Login
Masuk menggunakan akun Administrator resmi sekolah.

## Dashboard
Dashboard menampilkan total tagihan, sudah dibayar, belum dibayar, perlu verifikasi, penerimaan hari/bulan berjalan, tunggakan lewat tempo, dan transaksi terbaru. Data berasal dari PostgreSQL VPS.

## Data Siswa
- Tambah/Edit siswa
- Import Excel
- Aktif/Nonaktif siswa
- Pastikan NIS, kelas, nama wali, dan nomor HP wali benar

## Akun Wali
- Perbarui relasi wali
- Buat undangan aktivasi
- Atur sapaan/nama panggilan
- Reset akses
- Aktif/Nonaktif akun

Satu nomor HP dapat terhubung ke lebih dari satu anak.

## Kelas & Wali Kelas
Kelola kelas aktif, tahun ajaran, dan wali kelas. Satu wali kelas aktif tidak boleh ditugaskan ke dua kelas aktif sekaligus.

## Jenis Pembayaran
Buat master biaya/tagihan yang digunakan sekolah.

## Tagihan
- Buat individual
- Buat massal
- Batalkan/pulihkan sesuai kewenangan
- Gunakan WA Reminder untuk mengingatkan wali

## Verifikasi Bukti
Administrator dapat melihat file bukti private lalu memilih Terima atau Tolak. Bukti tanpa file fisik tidak boleh di-approve.

## Laporan
Gunakan filter tanggal, kelas, metode, dan status. Export tersedia dalam CSV/XLSX.

## Pengaturan Sekolah
Lengkapi profil sekolah, tahun ajaran, bendahara, rekening, QRIS, support email, logo, prefix/footer kwitansi, serta retensi backup.

Target Commercial Readiness sebelum go-live: 100%.

## Keamanan
Jangan bagikan password Admin. Gunakan Reset Akses untuk wali, bukan mengetahui password wali. Laporkan error dengan Request ID bila muncul.
