# Panduan Deployment (manual, Docker)

Panduan langkah-demi-langkah men-deploy backend dari **image Docker**, lalu
menyajikan frontend sebagai berkas statis lewat Nginx Anda sendiri.

Backend **tidak** dijalankan langsung dari source di server. Source dibangun
menjadi image immutable; konfigurasi di-inject saat runtime.

```
Internet → Nginx milik Anda (TLS) → container backend → MariaDB
```

> `Dockerfile` backend ada di `backend/Dockerfile`. Build context selalu
> `./backend` (jangan dari root, agar `node_modules` tidak ikut terkirim).
>
> File `docker-compose.yml` / `docker-compose.prod.yml` bersifat **opsional** —
> panduan ini memakai perintah `docker` langsung agar Anda bisa menyesuaikan
> sendiri.

---

## 1. Prasyarat server

- Docker Engine 24+
- Nginx (yang sudah berjalan) untuk TLS + menyajikan frontend
- MariaDB/MySQL — bisa container yang sudah ada (mis. pada network `dbcon`),
  atau instance eksternal
- 2 vCPU / 2 GB RAM minimum

---

## 2. Siapkan database

Buat database + user least-privilege (sekali saja):

```sql
CREATE DATABASE IF NOT EXISTS imigrasi_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'imigrasi_user'@'%' IDENTIFIED BY 'PASSWORD_DB_KUAT';
GRANT ALL PRIVILEGES ON imigrasi_db.* TO 'imigrasi_user'@'%';
FLUSH PRIVILEGES;
```

## 3. Siapkan konfigurasi (`.env`)

```bash
cp backend/.env.example backend/.env
```

Isi nilai produksi. Yang **wajib** dan divalidasi saat startup produksi:

```dotenv
APP_ENV=production
APP_VERSION=2.0.0                # jangan "dev"
DB_HOST=mariadb                  # nama service/container DB di network Docker
DB_NAME=imigrasi_db
DB_USER=imigrasi_user
DB_PASSWORD=PASSWORD_DB_KUAT
JWT_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=https://domain-anda.com    # tanpa wildcard, tanpa tanda kutip
COOKIE_SECURE=true
```

Catatan:
- Gunakan `ALLOWED_ORIGINS` format **dipisah koma tanpa tanda kutip** agar aman
  saat dibaca `docker --env-file`.
- Jangan pernah commit `backend/.env`.
- Aplikasi akan **gagal start** jika secret lemah/kosong, `APP_VERSION=dev`,
  `ALLOWED_ORIGINS` wildcard, atau `COOKIE_SECURE` tidak aktif.

## 4. Build image backend

```bash
./build-backend.sh 2.0.0
# hasil: imigrasi-backend:2.0.0 dan imigrasi-backend:latest
```

(Windows: jalankan via Git Bash/WSL, atau langsung
`docker build --build-arg APP_VERSION=2.0.0 -t imigrasi-backend:2.0.0 ./backend`.)

## 5. Jalankan migrasi database (eksplisit)

```bash
docker run --rm \
  --env-file ./backend/.env \
  --network dbcon \
  imigrasi-backend:2.0.0 \
  alembic upgrade head
```

Untuk database lama yang sudah berisi data, migrasi `0001_baseline` bersifat
idempoten (tidak menyentuh tabel lama) dan `0002_security` menambah kolom/tabel/
indeks tanpa menghapus data. Detail: [documentation/MIGRATIONS.md](documentation/MIGRATIONS.md).

Seed data awal (opsional, sekali):

```bash
docker run --rm --env-file ./backend/.env --network dbcon \
  imigrasi-backend:2.0.0 python seed.py
```

## 6. Jalankan container backend

Jika MariaDB Anda berada di network Docker `dbcon`:

```bash
docker run -d \
  --name imigrasi_backend \
  --restart unless-stopped \
  --env-file ./backend/.env \
  --network dbcon \
  --read-only \
  --tmpfs /tmp:size=64m \
  --security-opt no-new-privileges:true \
  --memory 1500m --cpus 2 \
  imigrasi-backend:2.0.0
```

Port **tidak** di-publish ke host — Nginx menghubungi `imigrasi_backend:8000`
lewat network yang sama.

Jika memakai DB di host (bukan Docker), tambahkan `--add-host=host.docker.internal:host-gateway`
dan set `DB_HOST=host.docker.internal`.

## 7. Verifikasi health

```bash
docker inspect --format '{{.State.Health.Status}}' imigrasi_backend      # healthy
docker exec imigrasi_backend \
  python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/health/ready').read())"
docker logs --tail 50 imigrasi_backend
```

## 8. Build frontend (static) & pasang di Nginx

```bash
cd frontend
npm ci
npm run build          # menghasilkan folder dist/
```

Salin `dist/` ke folder html Nginx Anda, mis. sebagai subfolder `imigrasi`:

```bash
cp -r dist/* /path/ke/nginx/html/imigrasi/
```

Lalu tempel blok dari [`nginx/imigrasi.conf`](nginx/imigrasi.conf) ke dalam
`server { }` Nginx Anda (yang sudah menangani TLS + redirect HTTP→HTTPS), dan
sesuaikan `proxy_pass http://imigrasi_backend:8000;`. Snippet sudah menangani:

- aset ter-hash di-cache `immutable`, `index.html` `no-cache`
- proxy `/imigrasi/api/` ke backend
- rate-limit endpoint login di edge
- SSE (`proxy_buffering off`, timeout panjang) agar notifikasi real-time

Untuk mengaktifkan HSTS, buka komentar baris `Strict-Transport-Security` setelah
HTTPS dipastikan berjalan.

Reload Nginx:

```bash
docker exec <nginx_container> nginx -t && docker exec <nginx_container> nginx -s reload
```

## 9. Uji terakhir

- `https://domain-anda.com/imigrasi/` → halaman login
- Login tiap role (agent/supervisor/admin)
- Verifikasi paspor + pindai MRZ, cekal, eskalasi, VOA, konter, laporan, audit, notifikasi
- Logout dan uji sesi kedaluwarsa

---

## Update versi (deploy ulang)

```bash
./build-backend.sh 2.0.1
docker run --rm --env-file ./backend/.env --network dbcon imigrasi-backend:2.0.1 alembic upgrade head
docker rm -f imigrasi_backend
docker run -d --name imigrasi_backend --restart unless-stopped \
  --env-file ./backend/.env --network dbcon \
  --read-only --tmpfs /tmp:size=64m \
  imigrasi-backend:2.0.1
```

Gunicorn menangani `SIGTERM` secara *graceful* saat `docker stop`.

## Rollback

1. Jalankan lagi image versi sebelumnya (tag sebelumnya).
2. Migrasi bersifat **add-only** → tidak perlu downgrade.
   `downgrade()` sengaja no-op demi keamanan data.

## Backup & restore

```bash
# Backup
docker exec <db_container> mariadb-dump -u root -p'PASSWORD' imigrasi_db > backup_$(date +%F).sql
# Restore
cat backup_2026-01-01.sql | docker exec -i <db_container> mariadb -u root -p'PASSWORD' imigrasi_db
```

Simpan backup di luar server (S3/NAS) dengan retensi terjadwal.

## Checklist produksi

- [ ] `APP_ENV=production`, `APP_VERSION` bukan `dev`
- [ ] `JWT_SECRET` acak ≥ 32 karakter, `DB_PASSWORD` kuat
- [ ] `ALLOWED_ORIGINS` = domain asli (tanpa `*`), `COOKIE_SECURE=true`
- [ ] Backend tidak publish port ke host; DB hanya di network privat
- [ ] Container non-root, `--read-only`, `--tmpfs /tmp`
- [ ] Migrasi dijalankan sebelum container baru
- [ ] Nginx TLS + HSTS + security headers aktif
- [ ] Backup otomatis + strategi retensi
- [ ] `backend/.env` tidak masuk Git
