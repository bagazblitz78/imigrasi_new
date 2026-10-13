# Sistem Pemeriksaan Imigrasi Bandara — Enhanced

Platform operasional imigrasi bandara yang **modern, aman, cepat, dan siap produksi**.
Aplikasi ini adalah hasil *rebuild* dari sistem lama: seluruh alur bisnis dipertahankan
(verifikasi paspor/MRZ, daftar cekal, eskalasi, VOA, konter, laporan, audit, notifikasi
real-time) namun dengan arsitektur, keamanan, UX, dan performa yang jauh lebih baik.

```
INTERNET
    │
    ▼
┌──────────────┐   static SPA + reverse proxy + TLS
│  Nginx (edge)│
└──────┬───────┘
       ├───────────────► Frontend (React build)
       │
       └───────────────► Backend API (FastAPI, immutable image)
                              │
                              ▼
                         MariaDB (private network)
```

## Fitur

| Domain | Kemampuan |
|--------|-----------|
| Autentikasi | JWT akses singkat + refresh token opaque (rotasi, revokasi), cookie `HttpOnly`, CSRF double-submit, idle timeout, rate limit login terdistribusi |
| RBAC | AGENT / SUPERVISOR / ADMIN, ditegakkan **di backend** + object-level authorization |
| Penumpang | Input + auto-cek daftar cekal, status (pending/approved/hold/deported/rejected), pagination/filter/sort server-side |
| MRZ | OCR Tesseract + validasi checksum ICAO TD3, pemrosesan lokal, hardening unggah gambar |
| Daftar cekal | Berbasis paspor/nama/keduanya, pencocokan ternormalisasi & terindeks, otomatis menahan penumpang |
| Eskalasi | Hold → notifikasi real-time ke supervisor → keputusan → audit |
| VOA | Pengajuan, keputusan supervisor, alasan penolakan wajib |
| Konter | Status (aktif/istirahat/nonaktif), penugasan petugas |
| Dashboard | Agent / Supervisor / Admin dengan hierarki informasi |
| Laporan | Statistik, ekspor CSV (masking data sensitif) |
| Audit | Jejak append-oriented dengan korelasi request-id |
| Notifikasi | SSE + riwayat tersimpan + hitung belum dibaca + reconnect backoff |

## Tumpukan teknologi

- **Frontend**: React 18, Vite, React Router, CSS design-system (tanpa UI lib berat)
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2 (async), Pydantic v2, Alembic
- **Auth**: `python-jose` (HS256), Argon2id + bcrypt legacy, refresh rotation
- **DB**: MariaDB / MySQL (kompatibel dengan database lama)
- **Infra**: Docker multi-stage, Gunicorn + Uvicorn workers, Nginx

## Mulai cepat (development)

```bash
cp .env.example .env          # isi minimal DB_PASSWORD & JWT_SECRET (nilai dev boleh)
docker compose up -d --build
docker compose exec backend python seed.py
```

- Frontend (Vite dev): http://localhost:5173/imigrasi/
- API + Swagger: http://localhost:8000/api/docs
- Akun seed (ganti setelah login): `admin/Admin1234!`, `supervisor1/Spv12345!`, `agent1/Agent123!`

## Mode demo (tanpa backend & database)

Ingin melihat UI-nya saja dengan data statis? Jalankan mode demo:

```bash
cd frontend
npm install
npm run dev:mock
```

Buka **http://localhost:5173/imigrasi/**. Aplikasi langsung masuk sebagai
**Administrator** dengan data contoh (46 penumpang, eskalasi, VOA, daftar cekal,
notifikasi, audit log). Akan ada badge **MODE DEMO** di header.

- Keluar lalu login dengan username apa saja untuk berpindah peran:
  `agent1` → dashboard petugas, `supervisor1` → dashboard supervisor, selain itu → admin.
- Data hanya di memori; muat ulang halaman akan mengembalikannya ke kondisi awal.
- Untuk build statis demo: `npm run build:mock`, lalu serve folder `dist/`
  (mis. `npx serve dist`). Mode demo **tidak** ikut pada build produksi biasa.

## Deploy ke Vercel (demo statis)

Vercel **tidak** cocok untuk backend (tanpa database persisten, tanpa SSE jangka
panjang). Yang benar di-deploy ke Vercel adalah **UI statis**.

Repo ini sudah menyiapkan `public/index.html` (demo mandiri) + `vercel.json` yang
memaksa deploy **statis** saja (mengabaikan deteksi Python), sehingga URL Vercel
langsung menampilkan aplikasi.

Langkah:
1. Commit & push `public/index.html` + `vercel.json` ke GitHub.
2. Di Vercel → Project → **Settings → General**:
   - **Root Directory**: biarkan **root repo** (`.`) — **bukan** `backend`.
   - **Framework Preset**: `Other`.
   - **Build Command** & **Output Directory**: **kosongkan** (kalau ada nilai
     lama seperti `frontend/dist`, hapus). Nilai akan diambil dari `vercel.json`.
3. **Redeploy**.

`vercel.json` sengaja eksplisit supaya Vercel tidak salah deteksi:
```json
{
  "framework": null,
  "outputDirectory": "public",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```
Artinya: Vercel menyajikan isi folder `public/` sebagai statis di `/`
(tanpa serverless/Python), dan semua path diarahkan ke `index.html`.

Fallback: backend juga melayani UI demo di `GET /` (file
`backend/app/static/index.html`), sehingga kalaupun Vercel malah menjalankan API
backend, membuka `/` tetap menampilkan aplikasi (bukan 404 JSON).

Ingin UI React asli (bukan demo)? Set Root Directory ke `frontend`, Framework
`Vite`. Tapi aplikasi akan gagal memuat data karena tidak ada API/database —
host backend terpisah (lihat [DEPLOY.md](DEPLOY.md)) dan set `VITE_API_BASE`.

## Produksi (deploy sendiri)

Panduan manual lengkap: **[DEPLOY.md](DEPLOY.md)**. Intinya cukup membangun image
backend dari `backend/Dockerfile` lalu menjalankannya:

```bash
cp backend/.env.example backend/.env      # isi variabel produksi
./build-backend.sh 2.0.0
docker run --rm --env-file ./backend/.env --network dbcon \
  imigrasi-backend:2.0.0 alembic upgrade head
docker run -d --name imigrasi_backend --restart unless-stopped \
  --env-file ./backend/.env --network dbcon \
  --read-only --tmpfs /tmp:size=64m imigrasi-backend:2.0.0
```

Frontend: `cd frontend && npm ci && npm run build`, lalu salin `dist/` ke folder
html Nginx Anda dan tempel [nginx/imigrasi.conf](nginx/imigrasi.conf).

> File `docker-compose.yml` / `docker-compose.prod.yml` bersifat **opsional**.

## Struktur proyek

```
imigrasi_me_enhanced/
├── backend/
│   ├── app/
│   │   ├── api/            # deps + v1 endpoints
│   │   ├── core/           # config, db, security, rate limit, logging, errors
│   │   ├── models/         # skema SQLAlchemy (data lama dipertahankan)
│   │   ├── schemas/        # validasi Pydantic
│   │   ├── repositories/   # query terpusat
│   │   ├── services/       # auth, blacklist, mrz, notifikasi, audit, image
│   │   └── utils/          # masking, normalisasi
│   ├── migrations/         # Alembic (baseline + security/indexes)
│   ├── tests/              # pytest (auth, RBAC, IDOR, upload, pagination)
│   ├── Dockerfile          # multi-stage, non-root
│   └── gunicorn_conf.py
├── frontend/
│   ├── src/
│   │   ├── api/ contexts/ hooks/ components/ layouts/ features/ pages/ styles/ utils/
│   └── Dockerfile + nginx.conf
├── nginx/imigrasi.conf     # snippet untuk edge Nginx yang sudah ada
├── docker-compose.yml       # development
├── docker-compose.prod.yml  # production
└── documentation/
```

## Pengujian

```bash
# Backend
cd backend && pip install -r requirements-dev.txt && pytest

# Frontend
cd frontend && npm install && npm test
```

## Performance testing (lakukan sendiri)

Panduan + skrip: **[PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md)** dan folder
[`scripts/`](scripts/) (`bench_api.sh`, `load_test.js`, `explain_queries.sql`,
`bundle_report.sh`).

## Dokumentasi

- [DEPLOY.md](DEPLOY.md) — langkah deploy manual (Docker + Nginx)
- [PERFORMANCE_TESTING.md](PERFORMANCE_TESTING.md) — cara mengukur performa
- [ARCHITECTURE.md](documentation/ARCHITECTURE.md)
- [SECURITY.md](documentation/SECURITY.md)
- [PERFORMANCE.md](documentation/PERFORMANCE.md)
- [DEPLOYMENT.md](documentation/DEPLOYMENT.md)
- [MIGRATIONS.md](documentation/MIGRATIONS.md)

## Kompatibilitas data lama

Skema tabel lama (`users`, `counters`, `passengers`, `blacklists`, `escalations`,
`voa_applications`, `audit_logs`) **dipertahankan apa adanya**. Migrasi `0001_baseline`
idempoten (hanya membuat tabel yang belum ada) dan `0002_security` menambahkan kolom
ternormalisasi, tabel keamanan, serta indeks **tanpa menghapus data**. Hash bcrypt lama
tetap valid dan otomatis di-*upgrade* ke Argon2id saat login berikutnya.
