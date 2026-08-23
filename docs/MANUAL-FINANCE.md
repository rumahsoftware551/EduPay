# Manual Finance / Bendahara EduPay

## Login
Masuk menggunakan akun Finance resmi sekolah.

## Dashboard
Menampilkan ringkasan tagihan, pembayaran, verifikasi pending, penerimaan hari/bulan berjalan, dan transaksi terbaru dari PostgreSQL.

## Pembayaran
Cari tagihan siswa lalu pilih metode:
- Cash
- Transfer
- QRIS

Sistem membuat nomor kwitansi dari server. Tagihan yang sudah lunas tidak dapat dibayar dua kali.

## Verifikasi Bukti
Finance dapat membuka bukti transfer private dari VPS lalu memilih:
- Terima → tagihan lunas + kwitansi dibuat
- Tolak → wajib alasan, status kembali belum bayar

## Void
Void hanya dilakukan bila transaksi benar-benar perlu dibatalkan. Alasan wajib diisi. Ledger pembayaran tetap tercatat sebagai VOID dan tagihan dibuka kembali.

## Kwitansi
Kwitansi resmi menampilkan sekolah, siswa, tagihan, nominal, metode, waktu, petugas, dan status VALID/VOID. Gunakan tombol Cetak / Simpan PDF bila diperlukan.

## Notifikasi
Lonceng menampilkan bukti transfer baru yang perlu diverifikasi. Klik notifikasi untuk menuju antrean verifikasi.

## Laporan
Gunakan laporan penerimaan/tunggakan dan export CSV/XLSX untuk kebutuhan administrasi.

## Keamanan
Jangan berbagi password Finance. Jangan approve bukti yang tidak dapat dibuka atau tidak sesuai. Bila ada error, catat Request ID dan laporkan ke Administrator/teknisi.
