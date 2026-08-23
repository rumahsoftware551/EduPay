# EduPay · School Finance — UI Professional V2

Prototype aplikasi pembayaran siswa dengan 3 portal:
- Administrator
- Finance / Bendahara
- Orang Tua / Wali

## Perubahan UI V2
- Login screen baru dengan tampilan modern dan ramah.
- Sidebar profesional dengan ikon dan status menu aktif.
- Dashboard ringkas dengan kartu statistik yang lebih mudah dibaca.
- Tabel, badge status, tombol, modal, dan empty state diperhalus.
- Layout responsive untuk desktop, tablet, dan mobile.
- Portal wali dibuat lebih sederhana dan friendly.
- Notifikasi visual untuk bukti pembayaran yang menunggu verifikasi.
- Tombol akun demo untuk pengujian cepat.

## Akun Demo
- Admin: `admin` / `admin123`
- Finance: `finance` / `finance123`
- Wali: `081234567890` / `wali123`

## Cara Menjalankan di Windows
Cara termudah:
1. Ekstrak ZIP.
2. Double-click `START-EDUPAY.bat`.
3. Browser akan membuka `http://localhost:8080`.

Jika launcher tidak berjalan, buka Command Prompt di folder project lalu jalankan:

`python -m http.server 8080`

Kemudian buka `http://localhost:8080`.

## Catatan
Versi ini masih berupa prototype client-side menggunakan LocalStorage. Cocok untuk validasi alur dan UI/UX. Untuk penggunaan sekolah sungguhan, tahap berikutnya perlu backend, database, autentikasi aman, audit log, backup, dan manajemen akses berbasis role.
