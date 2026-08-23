# EduPay V4.9 — Full Stability Audit

Tanggal audit: 23 Agustus 2026
Status: **BELUM SIAP GO-LIVE / BELUM SIAP DIJUAL** sampai seluruh P0 ditutup.

## Ringkasan arsitektur saat ini
EduPay berkembang dari prototype LocalStorage menjadi hybrid LocalStorage + PostgreSQL. Frontend memuat banyak file versi bertingkat yang saling menimpa fungsi global (`nav`, `shell`, `login`, `logout`, `views`, fungsi CRUD). Portal Wali sudah lebih banyak membaca PostgreSQL, sedangkan Admin/Finance masih banyak membaca dan menulis `db` LocalStorage lalu melakukan sinkronisasi asinkron.

Konsekuensi utamanya adalah **split-brain state**: browser berbeda atau portal berbeda dapat menampilkan status yang tidak sama pada waktu yang sama.

## P0 — Blocker go-live

### P0-01 — Admin/Finance masih local-first
**Dampak:** data siswa, jenis pembayaran, tagihan dan transaksi dapat berbeda antar browser/operator.

**Bukti kode:** `app.js` membuat `db` dari LocalStorage dan mayoritas CRUD di `admin-crud.js` mengubah `db`, menyimpan lokal, merender sukses, baru modul lain mencoba sinkronisasi ke server.

**Perbaikan V4.9:** PostgreSQL menjadi snapshot operasional utama untuk Admin/Finance. Browser hanya menyimpan cache.

### P0-02 — Finance tidak otomatis melihat bukti transfer server
Portal Wali mengubah bill PostgreSQL menjadi `pending`, tetapi halaman Finance membaca `db.bills` lokal. Ini dapat menyebabkan Finance tidak melihat bukti baru sampai browser lokal kebetulan tersinkron.

**Perbaikan V4.9:** polling server untuk Admin/Finance + refresh saat tab fokus, sehingga bill `pending` dari wali masuk ke layar Finance otomatis.

### P0-03 — Sinkronisasi transaksi tidak lengkap
`syncOperationalV44()` hanya mengirim `bills`. Daftar `payments` lokal Finance tidak ikut dikirim pada setiap transaksi. Migrasi V4.8 hanya menyelesaikan data historis satu kali.

**Perbaikan V4.9:** full operational sync mencakup fee types, bills dan payments.

### P0-04 — Jenis Pembayaran belum server-first
CRUD fee type V3.3 hanya mengubah LocalStorage. Setelah migrasi satu kali, perubahan berikutnya bisa tertinggal di browser.

**Perbaikan V4.9:** fee types ikut sinkron otomatis dan ditarik kembali dari PostgreSQL.

### P0-05 — Banyak override fungsi global berdasarkan urutan script
Contoh: `nav()` didefinisikan ulang oleh beberapa modul; `shell()` ditimpa mobile UI lalu dibungkus realtime parent; `login/logout` ditimpa beberapa kali; `views.*` diubah berulang.

**Risiko:** perubahan urutan `<script>` dapat memutus fitur tanpa syntax error.

**Arah perbaikan:** V4.9 menambahkan satu orchestration layer terakhir dan setelah stabil fase berikutnya harus menghapus modul patch lama menjadi satu `app-core` modular.

### P0-06 — UI dapat menyatakan sukses sebelum server berhasil
CRUD lokal sering `save(); render(); toast('berhasil')`, kemudian sinkronisasi server berjalan melalui `setTimeout` dan error disembunyikan pada mode silent.

**Risiko:** operator menganggap transaksi tersimpan padahal server gagal.

**Perbaikan bertahap:** V4.9 menambahkan status sinkron server dan retry. Tahap berikutnya mutasi kritis harus server-first sebelum toast sukses.

### P0-07 — Bukti transfer fisik belum tersimpan
Portal Wali hanya mengirim `proofName`; file JPG/PNG/PDF tidak di-upload.

**Dampak:** Finance tidak dapat membuka bukti asli. Ini blocker finansial.

**Status:** BELUM DIPERBAIKI V4.9. Harus dibuat multipart upload + private storage + MIME/size validation.

### P0-08 — Nomor kwitansi dibuat client-side
Prototype membuat receipt dari tanggal + jumlah array lokal.

**Risiko:** dua operator dapat menghasilkan nomor yang bertabrakan.

**Status:** BELUM DIPERBAIKI V4.9. Harus dibuat server-side sequence per sekolah.

### P0-09 — CSRF belum tersedia
Session menggunakan cookie server, tetapi endpoint POST tidak memakai CSRF token.

**Status:** BELUM DIPERBAIKI V4.9. Harus ditambahkan sebelum production.

### P0-10 — Session diduplikasi ke LocalStorage
Server session adalah otoritas auth, tetapi copy session juga disimpan di LocalStorage.

**Risiko:** UI dapat sempat menampilkan state stale sebelum `/auth/me` selesai.

**Arah:** cache profil boleh ada, tetapi authorization tidak boleh bergantung pada LocalStorage.

### P0-11 — Demo credentials masih ada di source/login UI lama
`app.js` masih memiliki `admin/admin123`, `finance/finance123`, `wali123` dan Mode Demo.

**Risiko:** membingungkan operator dan berbahaya bila fallback lokal hidup kembali.

**Status:** harus dihapus pada hardening produksi.

### P0-12 — API terpecah `/api`, `/api/v44`, `/api/v46`, `/api/v47`, `/api/v48`
**Risiko:** konfigurasi Nginx dan dependency antarversi sulit dipelihara, rawan endpoint lama tertinggal.

**Arah:** setelah stabil, konsolidasikan menjadi `/api/v1/*` dengan satu router.

### P0-13 — Error sinkronisasi banyak ditelan
Beberapa `catch(e){}` / `silent:true` membuat kegagalan server tidak terlihat.

**Arah:** event error terpusat + banner offline/sync failed + audit client log.

### P0-14 — Belum multi-tenant production
Konfigurasi menggunakan satu `school_code` default. Database sudah punya `school_id`, tetapi onboarding/isolation testing sekolah banyak belum selesai.

**Status:** blocker untuk dijual ke banyak sekolah.

## Audit Portal Administrator

### Sudah tersedia
- Server auth Admin.
- CRUD lokal siswa, kelas, wali kelas, fee type, tagihan.
- Import Excel siswa dan wali kelas.
- Akun wali server-side.
- Migrasi data lokal → PostgreSQL.

### Bug/risiko utama
1. CRUD masih local-first.
2. Browser Admin kedua dapat berbeda sampai sync.
3. Fee type belum otomatis server-sync sebelum V4.9.
4. Tagihan baru menampilkan sukses sebelum server sync berhasil.
5. Mass billing duplikasi hanya dicek pada data lokal.
6. Filter/pagination bersifat DOM/client-side, bukan server pagination; tidak cocok untuk 10.000+ siswa.
7. Kelas/Wali Kelas masih mempunyai mapping external ID yang kompleks dan rawan konflik jika dibuat dari beberapa browser.
8. Migrasi tetap tampil sebagai menu operasional padahal seharusnya hanya maintenance/setup.

## Audit Portal Finance

### P0 khusus Finance
1. Bukti transfer dari wali berada di PostgreSQL sementara Finance membaca LocalStorage.
2. File bukti asli belum tersedia.
3. Payment record lokal belum selalu tersimpan server.
4. Receipt dibuat client-side.
5. Void transaksi belum mewajibkan alasan dan belum sepenuhnya audit-safe.
6. Approve/reject dapat bekerja terhadap state lokal stale.
7. Tidak ada locking/idempotency saat dua Finance memproses tagihan yang sama.

### Target
- Finance membaca bills/payments dari PostgreSQL.
- Approve/reject atomik di server.
- Payment dibuat sekali secara transaction-safe.
- Receipt dibuat server.

## Audit Portal Orang Tua / Wali

### Yang sudah lebih baik
- Auth/aktivasi server-side.
- Relasi multi-anak server-side.
- Greeting server-side.
- Dashboard/tagihan/notifikasi membaca PostgreSQL.

### Bug/risiko
1. Upload bukti hanya nama file.
2. History menampilkan bill paid, bukan ledger payment/receipt lengkap.
3. Kwitansi resmi server-side belum tersedia.
4. Polling 20 detik cukup untuk UI, tetapi bukan push notification.
5. Session profile masih dicache LocalStorage.
6. Bila Admin/Finance belum sinkron server, wali melihat data berbeda dari operator.

## P1 — Setelah P0 stabil
- Server-side pagination/search/filter.
- Tahun ajaran/semester aktif.
- Kenaikan kelas/alumni.
- Diskon/beasiswa/cicilan.
- Laporan server-side per tanggal/metode/kelas.
- Export Excel/PDF server-side.
- Profil sekolah/logo/rekening/QRIS.
- User management Admin/Finance.

## Urutan perbaikan yang disepakati
1. **V4.9 Stability:** server snapshot Admin/Finance + full operational sync + visibility status.
2. **V5.0 Finance Transaction Safety:** payment/verification server-first, receipt server-side, void reason.
3. **V5.1 Proof Storage:** upload file asli ke storage VPS/private object storage.
4. **V5.2 Admin Server CRUD:** siswa/kelas/fee/tagihan mutasi langsung API, bukan LocalStorage.
5. **V5.3 Security:** CSRF, security headers, session hardening, audit/error log.
6. **V6.0 Commercial:** multi-tenant, school onboarding, backup/restore, UAT, CI/CD.

## Kesimpulan
Aplikasi sudah memiliki banyak fitur UI dan backend awal, tetapi belum boleh diposisikan sebagai produk siap jual. Masalah terbesar bukan kekurangan menu, melainkan **dua sumber data yang berjalan paralel**. Fokus pertama harus menghilangkan perbedaan state antar portal dan antar browser.