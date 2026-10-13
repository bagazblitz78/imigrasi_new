# Performa

## 1. Prinsip

Optimasi hanya dilakukan pada jalur yang terukur/berpotensi menjadi bottleneck, tanpa
mengorbankan korektibilitas. Query yang dioptimasi: listing penumpang, statistik
dashboard, pengecekan daftar cekal (jalur kritis saat pembuatan penumpang), audit log,
eskalasi, dan VOA.

## 2. Database — indeks

Dibuat di migrasi `0002_security` (idempoten, hanya jika belum ada):

| Tabel | Indeks | Fungsi |
|-------|--------|--------|
| `passengers` | `(agent_id, created_at)`, `(status, created_at)`, `(direction, created_at)`, `(counter_id, created_at)`, `(created_at)`, `passport_number`, `full_name` | Listing/filter/sort & dashboard agent |
| `blacklists` | `(is_active, passport_number)`, `(is_active, full_name)`, `passport_normalized`, `name_normalized` | Pencocokan cekal cepat |
| `escalations` | `(decision, created_at)`, `(created_at)` | Hold desk pending + aging |
| `voa_applications` | `(status, applied_at)`, `(applied_at)` | Daftar VOA pending |
| `audit_logs` | `(user_id, created_at)`, `(action, created_at)`, `(created_at)`, `request_id` | Query audit terfilter |
| `users` | `role`, `is_active`, plus unique `username`/`email` | Filter user |
| `refresh_tokens` | `token_hash` (unique), `(user_id)`, `(expires_at)` | Validasi & pembersihan token |
| `login_attempts` | `(ip_address, created_at)`, `(username, created_at)`, `(created_at)` | Rate limit |
| `notifications` | `(user_id, is_read, created_at)` | Bell & unread count |

> Indeks diarahkan pada pola query nyata (prefix `is_active`, arah + waktu), bukan
> dibuat serampangan. Jalankan `EXPLAIN` untuk query baru sebelum menambah indeks.

## 3. Optimasi query

- **Avoid N+1**: relasi yang dipakai (`Passenger.agent`, `Passenger.counter`,
  `Escalation.passenger`, `VOA.passenger`, `AuditLog.user`) memakai `lazy="joined"`/`selectinload`.
- **Statistik dashboard** dihitung dengan satu query agregat (`SUM(CASE …)`) untuk
  total/arah/status, bukan banyak query terpisah.
- **Pagination server-side** dengan `LIMIT/OFFSET` + hitungan total terpisah; kolom sort
  di-whitelist. Tidak ada pemuatan ribuan baris ke browser.
- **Ekspor CSV** memakai streaming response, bukan menyusun response raksasa di memori.
- **Blacklist** mencocokkan kolom ternormalisasi terindeks (bukan `ILIKE '%...%'`).

## 4. API & runtime

- SQLAlchemy async (`aiomysql`) + connection pool (`pool_size=10`, `max_overflow=20`).
- Operasi CPU-bound (OCR MRZ) dijalankan di thread pool dengan **semaphore** (maks. 3
  OCR paralel) dan **timeout** — event loop tidak diblokir.
- Rate limit & pencabutan sesi memakai operasi terindeks sehingga murah.
- Logging terstruktur JSON tanpa serialisasi berlebihan; body hanya di-log untuk JSON
  dan pada status error.

## 5. Frontend

### Code splitting (hasil build nyata)

Route-level `React.lazy` memecah bundle. Hasil `npm run build`:

| Aset | Ukuran | gzip |
|------|--------|------|
| `react` (vendor) | ~164 kB | ~53 kB |
| `index` (shell + auth + layout) | ~34 kB | ~12 kB |
| `index.css` | ~22 kB | ~5 kB |
| Halaman fitur (masing-masing) | 0.5–11 kB | 0.3–4 kB |

Halaman admin/berat (Users, Reports, Audit, Blacklist) **tidak** ikut bundle awal agent.

### Optimasi lain

- `useApiQuery`: cache dengan `staleTime`, pembatalan `AbortController` (mencegah respons
  lama menimpa hasil baru), dan refetch eksplisit.
- **Debounce** pencarian (350 ms) → tidak ada request per ketukan tombol.
- **Table** merender hanya satu halaman; kolom sort tidak memicu refetch penuh yang tak perlu.
- Aset ter-hash di-cache `immutable` 1 tahun; `index.html` `no-cache`.
- Font memakai system-UI stack (tanpa unduhan font eksternal → lebih cepat & offline-friendly).

## 6. Koneksi & jaringan tidak stabil

- SSE punya **reconnect exponential backoff** (maks. 30 s) + indikator status live/offline.
- Tombol aksi critical **disabled saat proses** (mencegah double submit).
- Indikator online/offline di topbar.

## 7. Caching

| Objek | Strategi |
|-------|----------|
| Aset statis ter-hash | `Cache-Control: public, immutable, max-age=1y` |
| `index.html` | `no-cache` |
| Data server (klien) | Cache in-memory dengan `staleTime` per query |
| Respons sensitif | **Tidak** di-cache (`no-store`) |

## 8. Metodologi benchmark

Untuk memvalidasi di lingkungan nyata:

1. `EXPLAIN <query>` untuk query listing/dashboard → pastikan memakai indeks (hindari
   `ALL`/full scan).
2. Ukur latensi endpoint (`/passengers`, `/reports/passengers/stats`,
   `/passengers/scan-mrz`) memakai `hey`/`k6` sebelum & sesudah perubahan.
3. Pantau `duration_ms` pada log request (`app.request`) — sudah tercatat per request.
4. Ukur bundle memakai `vite build --mode production` dan `rollup-plugin-visualizer`
   bila ingin analisis lanjutan.

> Catatan jujur: angka latensi DB belum diukur pada environment target; tabel di atas
> adalah ukuran build frontend yang benar-benar dihasilkan proyek ini. Lakukan langkah
> di atas pada server operasional untuk angka definitif.
