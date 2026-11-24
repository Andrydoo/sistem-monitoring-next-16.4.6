# Sistem Monitoring Penagihan Piutang Pelanggan — PT PLN (Persero) ULP Kraksaan

Aplikasi web terintegrasi berbasis **Next.js 16 (App Router)**, **Prisma ORM**, dan **MySQL** untuk mendukung operasional pemantauan penagihan piutang pelanggan (TUL III-09), pelaporan kinerja 7 indikator petugas, verifikasi bukti lapangan, serta pelaporan eksekutif di lingkungan **PT PLN (Persero) ULP Kraksaan (Kode Unit 51304)**.

---

## 1. Ringkasan Arsitektur & Fitur Utama

### Arsitektur Teknis
- **Framework & Runtime:** Next.js 16.4.6 (App Router, React 19, TypeScript, Node.js Runtime untuk Route Handler pemrosesan Excel & berkas privat).
- **Basis Data & ORM:** MySQL dengan Prisma Client (`prisma/schema.prisma`) meliputi entitas `Pengguna`, `Pelanggan`, `Piutang`, `Penagihan`, `Evidence`, `KinerjaPetugas`, `Pengingat`, dan `AuditLog`.
- **Autentikasi & Otorisasi (RBAC):** Auth.js v5 (`next-auth`) berbasis kredensial & JWT session (masa berlaku 12 jam shift kerja) dengan isolasi akses ketat di `proxy.ts` dan `lib/auth-guard.ts` untuk 3 peran:
  - **ADMIN** (`/admin/*`): Kontrol penuh impor Excel, pemetaan anomali, *load balancing* petugas, manajemen pengguna, sinkronisasi pengingat, inspeksi evidence, dan ekspor laporan.
  - **PIMPINAN** (`/pimpinan/*`): Monitoring eksekutif *read-only* (dashboard analitik, daftar detail piutang, inspeksi riwayat kunjungan & foto evidence privat) serta hak unduh Laporan Detail Piutang 21 Kolom Excel.
  - **PETUGAS** (`/petugas/*`): Antarmuka *mobile-first* operasional lapangan dengan isolasi data ketat (hanya melihat/menginput piutang miliknya sendiri).

### Fitur Operasional Utama
1. **Impor Excel Tervalidasi & Rekonsiliasi Otomatis:**
   - Impor Daftar Piutang **12 kolom** (`POST /api/admin/import/piutang`) dengan *upsert* pelanggan & piutang, karantina otomatis baris anomali (`UNASSIGNED`), serta verifikasi **Lunas Resmi otomatis** (`LUNAS_RESMI`) bagi pelanggan yang tidak lagi muncul pada impor ulang periode berjalan.
   - Impor Rekap 7 Indikator Kinerja Petugas **11 kolom** (`POST /api/admin/import/kinerja`) sebagai sumber resmi saldo buku.
   - Unduh templat resmi `.xlsx` melalui `GET /api/admin/templates/[type]` (`piutang` / `kinerja`).
2. **Pemisahan Tegas Saldo Buku Resmi vs Klaim Lapangan:**
   - Input penyelesaian `LUNAS_ONLINE` atau `TITIP_LUNAS` oleh petugas mengubah status piutang menjadi `KLAIM_LAPANGAN` dan **tidak memotong** `KinerjaPetugas.saldoAkhirPeriode` maupun `saldoAkhirBulan` hingga diverifikasi melalui impor Excel resmi berikutnya.
3. **Pelaporan Kunjungan Lapangan, Validasi Kondisional, & Batas Edit 24 Jam:**
   - Validasi kondisional ketat (`POST /api/petugas/penagihan` & `PATCH /api/petugas/penagihan/[id]`): catatan kendala wajib pada `DI_LUAR_KENDALI_PETUGAS`, foto bukti `PEMUTUSAN` wajib pada `DIPUTUS`, rentang janji bayar wajib pada `JANJI_BAYAR`, serta mekanisme *fallback* alasan kendala GPS apabila koordinat tidak terkunci.
   - Koreksi laporan kunjungan dibatasi maksimal **24 jam** sejak `waktuInput` dan tercatat penuh di `AuditLog`.
4. **Penjadwalan Pengingat Janji Bayar Otomatis:**
   - Evaluasi deterministik & *idempotent* untuk rentang `TGL_1_5`, `TGL_6_10`, `TGL_11_15`, `TGL_16_20`, dan `DI_ATAS_20` (transisi `MASA_JANJI_BAYAR` saat masuk rentang dan `OVERDUE` pada Hari Terakhir + 1).
5. **Ekspor Laporan Detail Piutang 21 Kolom Excel:**
   - Endpoint `GET /api/monitoring/export/piutang` menghasilkan berkas `.xlsx` berformat korporat PT PLN dengan 21 kolom eksak sesuai spesifikasi, format teks (`@`) untuk menjaga keutuhan 12 digit ID Pelanggan, format akuntansi Rupiah, *freeze header*, *auto-filter*, tautan URL evidence privat, dan pencatatan `AuditLog`.

---

## 2. Prasyarat & Langkah Instalasi

### Prasyarat Lingkungan
- **Node.js** versi `20.x` atau lebih baru (`npm` terpasang).
- **MySQL Server** versi `8.0+` (atau MariaDB yang kompatibel dengan Prisma MySQL).
- Akses direktori lokal tulis-baca untuk penyimpanan privat `./storage/evidence/`.

### Langkah Instalasi

1. **Instalasi Dependensi:**
   ```bash
   npm install
   ```

2. **Konfigurasi Variabel Lingkungan (`.env`):**
   Salin `.env.example` menjadi `.env` lalu sesuaikan dengan kredensial MySQL dan rahasia produksi:
   ```bash
   cp .env.example .env
   ```
   Daftar variabel wajib di `.env`:
   ```env
   DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/pln_monitoring_piutang"
   AUTH_SECRET="ganti-dengan-openssl-rand-base64-32-untuk-produksi"
   AUTH_TRUST_HOST="true"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   CRON_SECRET="ganti-dengan-token-acak-panjang-untuk-cron-produksi"
   ```
   > **Catatan Produksi:** Hasilkan `AUTH_SECRET` dan `CRON_SECRET` secara acak minimal 32 byte (mis. `openssl rand -base64 32`) serta pastikan `NEXT_PUBLIC_APP_URL` menunjuk ke domain HTTPS operasional agar tautan `URL Evidence Privat` pada ekspor Excel valid.

3. **Migrasi Skema Basis Data Prisma:**
   - Untuk lingkungan **pengembangan**:
     ```bash
     npx prisma migrate dev
     ```
   - Untuk lingkungan **produksi / staging**:
     ```bash
     npx prisma migrate deploy
     npx prisma generate
     ```

4. **Inisialisasi Data Awal (Seed):**
   ```bash
   npx prisma db seed
   ```
   Skrip `prisma/seed.ts` bersifat *idempotent* dan membuat 4 akun awal, 6 pelanggan & piutang periode `2026-09`, rekap kinerja awal, serta 1 entri `AuditLog` inisialisasi.

5. **Menjalankan Aplikasi:**
   - Mode pengembangan:
     ```bash
     npm run dev
     ```
   - Build & jalankan mode produksi:
     ```bash
     npm run build
     npm run start
     ```

---

## 3. Daftar Akun Awal Pengujian (`prisma/seed.ts`)

Seluruh akun awal di bawah ini menggunakan kata sandi pengujian bawaan **`PlnKraksaan2026!`** (wajib segera diganti pada lingkungan produksi melalui menu Manajemen Pengguna Administrator):

| Username | Nama Lengkap | Peran (`PeranPengguna`) | Kode Unit | Akses Utama |
| :--- | :--- | :--- | :--- | :--- |
| `admin_kraksaan` | Admin ULP Kraksaan | `ADMIN` | `51304` | `/admin`, impor Excel, anomali, load balancing, pengguna, ekspor Excel |
| `manajer_ulp` | Manajer ULP Kraksaan | `PIMPINAN` | `51304` | `/pimpinan`, monitoring eksekutif *read-only*, inspeksi evidence, ekspor Excel |
| `ptg_01` | Budi Santoso | `PETUGAS` | `51304` | `/petugas`, daftar tugas pribadi, input kunjungan & unggah evidence |
| `ptg_02` | Agus Pratama | `PETUGAS` | `51304` | `/petugas`, daftar tugas pribadi, input kunjungan & unggah evidence |

---

## 4. Konfigurasi Jadwal Cron Harian Evaluasi Janji Bayar

Sistem menyediakan endpoint terproteksi **`POST /api/cron/evaluate-reminders`** untuk mengevaluasi seluruh pengingat aktif dan memperbarui status piutang menjadi `MASA_JANJI_BAYAR` atau `OVERDUE` secara otomatis.

- **Jadwal Wajib:** Setiap hari pukul **07.00 WIB** = **`0 0 * * *` (UTC)**.
- **Autentikasi:** Header HTTP `Authorization: Bearer <CRON_SECRET>` (atau `x-cron-secret: <CRON_SECRET>`).

### Contoh Konfigurasi Linux (`crontab -e`)
```cron
# Jalankan evaluasi pengingat janji bayar setiap hari pukul 07.00 WIB (00.00 UTC)
0 0 * * * curl -fsS -X POST "https://domain-internal-pln.go.id/api/cron/evaluate-reminders" -H "Authorization: Bearer <CRON_SECRET>" -H "Content-Type: application/json" >> /var/log/pln-monitoring-cron.log 2>&1
```

### Contoh Pengujian Manual / Windows PowerShell
```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/cron/evaluate-reminders" `
  -Headers @{ Authorization = "Bearer <CRON_SECRET>" } `
  -ContentType "application/json"
```

> Untuk keperluan simulasi QA/audit tanggal tertentu, endpoint menerima payload opsional JSON `{ "referenceDate": "YYYY-MM-DD" }`. Selain pemicu Cron otomatis, Administrator juga dapat memicu sinkronisasi manual dari halaman `/admin/piutang` melalui tombol **Sinkronkan Jadwal Janji Bayar**.

---

## 5. Keamanan Penyimpanan Privat Evidence (Kepatuhan UU PDP)

Sesuai prinsip pelindungan data pribadi pelanggan (UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi / UU PDP), seluruh dokumentasi foto kunjungan lapangan (foto rumah, kWh meter, dan bukti pemutusan) tunduk pada kebijakan penyimpanan berikut:

1. **Lokasi Penyimpanan Privat Non-Publik:**
   - Seluruh berkas foto disimpan di luar direktori `public/`, yakni pada jalur **`./storage/evidence/{periode}/{id_piutang}/`** (contoh: `./storage/evidence/2026-09/12/pemutusan_1760000000000_a1b2c3d4e5f6.jpg`).
   - Direktori `storage/evidence/*` dikecualikan dari repositori Git melalui `.gitignore` (hanya `.gitkeep` yang dipertahankan).
2. **Validasi Berkas Ketat di Server (`lib/evidence-storage.ts`):**
   - Batas ukuran maksimal **300 KB** per foto.
   - Verifikasi ganda tipe MIME dan *magic bytes* biner (hanya menerima gambar valid **JPG/JPEG**, **PNG**, dan **WebP**).
   - Proteksi *path traversal* saat penulisan, pembacaan, dan penghapusan berkas.
3. **Akses Terkontrol Melalui Proxy RBAC (`GET /api/evidence/[id]`):**
   - Permintaan tanpa sesi ditolak dengan `HTTP 401 Unauthorized`.
   - `ADMIN` dan `PIMPINAN` dapat memeriksa seluruh evidence untuk keperluan verifikasi dan audit.
   - `PETUGAS` hanya diizinkan membaca evidence pada piutang yang ditugaskan kepadanya; akses ke evidence petugas lain ditolak ketat dengan `HTTP 403 Forbidden`.
   - Seluruh respons biner dilengkapi header `Cache-Control: private, no-store, max-age=0` dan `X-Content-Type-Options: nosniff`.
4. **Rekomendasi Operasional Server:**
   - Lakukan pencadangan (*backup*) berkala pada basis data MySQL sekaligus direktori `./storage/evidence/` secara terenkripsi.
   - Pastikan hak akses sistem berkas (*file permission*) folder `./storage/evidence/` hanya dapat dibaca/ditulis oleh akun sistem yang menjalankan layanan Next.js.
