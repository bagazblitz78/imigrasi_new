# Deployment

Panduan men-deploy sistem ke server produksi. Backend **selalu** dijalankan dari image
Docker immutable; source code **tidak** disalin/dijalankan langsung di server.

## 1. Arsitektur deployment

```
        Internet
            │ HTTPS
            ▼
   ┌───────────────────┐
   │  Nginx (edge)      │  TLS termination, security headers, rate limit login
   │  imigrasi-frontend │  serve SPA + proxy /imigrasi/api
   └───────┬───────────┘
           │ internal network
           ├──────────────► imigrasi-backend (immutable image)
           │                     │
           │                     ▼
           └──────────────► MariaDB (private, volume persisten)
```

## 2. Prasyarat server

- Docker Engine 24+ & Docker Compose v2
- 2 vCPU / 2 GB RAM minimum (naikkan bila OCR sering dipakai); disk untuk volume DB
- Domain + sertifikat TLS (mis. Let's Encrypt) bila terminasi TLS di Nginx

## 3. Konfigurasi environment (secrets)

```bash
cp .env.example .env
# isi DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET (openssl rand -hex 32),
# ALLOWED_ORIGINS, APP_VERSION/BACKEND_IMAGE/FRONTEND_IMAGE, COOKIE_DOMAIN
```

> Aplikasi **fail-fast** bila di produksi `JWT_SECRET` lemah/kosong, `DB_PASSWORD`
> default, `ALLOWED_ORIGINS` kosong/wildcard, `COOKIE_SECURE` tidak aktif, atau
> `APP_VERSION=dev`.

## 4. Build & registry (CI/CD)

```
Source (Git) → CI build → image bertag (git SHA / semver) → registry → server pull
```

```bash
# Build image backend (imutabel) dan frontend
docker build --build-arg APP_VERSION=$GIT_SHA -t registry/imigrasi-backend:$GIT_SHA ./backend
docker build -t registry/imigrasi-frontend:$GIT_SHA ./frontend
docker push registry/imigrasi-backend:$GIT_SHA
docker push registry/imigrasi-frontend:$GIT_SHA
```

Gunakan tag **git SHA / semver**, jangan hanya `latest`. Satu image yang sama dapat
dipakai untuk staging & produksi (konfigurasi di-inject saat runtime).

## 5. Deploy

Di server produksi (tanpa source backend):

```bash
# 1. Siapkan .env (secrets) — seperti langkah 3
# 2. Tarik image bertag
docker compose -f docker-compose.prod.yml pull
# 3. Jalankan migrasi database (eksplisit, terkontrol)
docker compose -f docker-compose.prod.yml run --rm migrate
# 4. Jalankan layanan
docker compose -f docker-compose.prod.yml up -d
```

Atau bila ingin build langsung di server: `docker compose -f docker-compose.prod.yml build`.

## 6. Verifikasi

```bash
docker compose -f docker-compose.prod.yml ps
curl -f http://localhost/healthz                      # nginx
docker compose -f docker-compose.prod.yml exec backend \
  python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/health/ready').read())"
```

Lalu uji manual: login setiap role, verifikasi paspor, cekal, eskalasi, VOA, konter,
laporan, audit, notifikasi, logout, dan sesi kedaluwarsa.

## 7. TLS

Terminasi TLS di Nginx edge. Tambahkan `listen 443 ssl;` + sertifikat di
`frontend/nginx.conf`, aktifkan header HSTS (yang saat ini dikomentari), dan alihkan
HTTP→HTTPS. Set `COOKIE_SECURE=true` (wajib di produksi).

## 8. Migrasi database

Migrasi dijalankan oleh service `migrate` (sekali, sebelum backend). Lihat
[MIGRATIONS.md](MIGRATIONS.md). Untuk database lama yang sudah berjalan, lihat bagian
"Adopsi database lama".

## 9. Backup & restore

```bash
# Backup
docker compose -f docker-compose.prod.yml exec db \
  mariadb-dump -u root -p"$DB_ROOT_PASSWORD" imigrasi_db > backup_$(date +%F).sql
# Restore
cat backup_2026-01-01.sql | docker compose -f docker-compose.prod.yml exec -T db \
  mariadb -u root -p"$DB_ROOT_PASSWORD" imigrasi_db
```

Simpan backup di luar container (S3/NAS) dengan retensi terjadwal.

## 10. Rollback

1. Ubah `BACKEND_IMAGE`/`FRONTEND_IMAGE` ke tag sebelumnya di `.env`.
2. `docker compose -f docker-compose.prod.yml up -d`.
3. Jika migrasi bersifat add-only (seperti `0002_security`), tidak perlu downgrade.
   **Migrasi downgrade bersifat no-op** demi keamanan data — perubahan di-*roll
   forward*, bukan destruktif.

## 11. Scaling & resource

- `WEB_CONCURRENCY` mengatur jumlah worker Gunicorn (default 2). Naikkan sesuai RAM
  (tiap worker memuat stack OCR).
- Batas resource contoh ada di `docker-compose.prod.yml` (`deploy.resources`). Sesuaikan
  dengan beban nyata dan pantau.
- Untuk banyak konter, naikkan jumlah worker/backend; state rate limit & sesi tersimpan
  di DB (aman multi-worker).

## 12. Logging

- Container menulis ke stdout/stderr (structured: `LOG_FORMAT=json`).
- Konfigurasi log Docker agar rotasi (`logging: driver: json-file, options: max-size=10m, max-file=5`)
  atau kirim ke sistem log terpusat. Jangan simpan log di dalam container.

## 13. Kompatibilitas dengan setup lama

Bila server sudah menjalankan Nginx + MariaDB sendiri pada network Docker `dbcon`:

- Jalankan backend pada network yang sama, lalu pakai snippet `nginx/imigrasi.conf`
  (tanpa container Nginx baru).
- Backend tetap dibuild menjadi image dan dijalankan sebagai container (bukan source
  di-mount). Cukup sesuaikan `networks`/`env` pada compose.

## 14. Troubleshooting

| Gejala | Penyebab umum |
|--------|---------------|
| Backend gagal start | Env produksi tidak lengkap → cek log "Konfigurasi production tidak valid" |
| `503` pada `/health/ready` | MariaDB belum siap / kredensial salah |
| Login `403 CSRF` | `ALLOWED_ORIGINS`/domain atau cookie tidak selaras; pastikan HTTPS & `Secure` |
| SSE tidak realtime | `proxy_buffering off` hilang di Nginx / timeout terlalu pendek |
| MRZ gagal | Kualitas foto rendah; pastikan `tesseract-ocr` ada di image (sudah disertakan) |
