# Panduan Performance Testing (lakukan sendiri)

Dokumen ini berisi **cara mengukur** performa sistem pada environment target Anda.
Tidak ada angka hasil yang dipalsukan di sini — jalankan langkah-langkah ini lalu
catat hasilnya.

Skrip pendukung ada di `scripts/`. Target metrik ada di bagian 9.

---

## 0. Prasyarat alat

| Alat | Kegunaan | Pasang |
|------|----------|--------|
| `hey` | Load test HTTP sederhana | `go install github.com/rakyll/hey@latest` atau unduh binary |
| `k6` | Load test berbasis skenario | https://k6.io/docs/get-started/installation/ |
| `mysql`/`mariadb` client | Cek query plan & slow log | paket `mariadb-client` |
| `node` + `npm` | Analisis bundle frontend | — |
| `jq` | Parsing JSON (opsional) | paket `jq` |

Siapkan variabel umum:

```bash
export BASE="https://domain-anda.com/imigrasi/api/v1"
export HEALTH="https://domain-anda.com/imigrasi/api/v1/health"  # sesuaikan
export USER="agent1"
export PASS="password-uji"
chmod +x scripts/*.sh
```

---

## 1. Ukur baseline DB: query plan (EXPLAIN)

Tujuan: memastikan query penting memakai indeks (bukan `ALL`/full scan).

```bash
mysql -h <host> -u imigrasi_user -p imigrasi_db < scripts/explain_queries.sql
```

Periksa kolom `type` dan `key`:

| Kolom | Nilai baik | Nilai buruk |
|-------|-----------|-------------|
| `type` | `ref`, `range`, `eq_ref`, `const` | `ALL` (full scan) |
| `key` | nama indeks (mis. `ix_passengers_agent_created`) | `NULL` |
| `rows` | kecil & realistis | mendekati total tabel |

Contoh query yang diuji ada di `scripts/explain_queries.sql` (listing penumpang,
cek cekal, eskalasi pending, VOA pending, audit log, statistik).

Aktifkan **slow query log** untuk audit berkelanjutan:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;         -- detik
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

---

## 2. Ukur latensi endpoint (hey)

Skrip `scripts/bench_api.sh` melakukan login lalu mengukur endpoint utama:

```bash
./scripts/bench_api.sh
# hasil tersimpan di reports/bench-<timestamp>.txt
```

Cakupan: `/auth/login`, `/passengers/` (pagination), `/passengers/dashboard/agent`,
`/escalations/dashboard/supervisor`, `/reports/passengers/stats`,
`/reports/audit-logs`, `/notifications/unread-count`.

Contoh manual untuk satu endpoint:

```bash
hey -n 200 -c 20 \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE/passengers/?page=1&page_size=25"
```

Perhatikan bagian **Latency distribution** (p50/p95/p99) dan **Requests/sec**.

---

## 3. Load test berbasis skenario (k6)

`scripts/load_test.js` mensimulasikan perilaku nyata: login → listing → dashboard →
cek daftar cekal (buat penumpang) dengan ramp-up bertahap.

```bash
k6 run \
  -e BASE="$BASE" \
  -e USER="$USER" -e PASS="$PASS" \
  scripts/load_test.js
```

Sesuaikan tahapan beban di bagian `options.stages` sesuai jumlah konter
(mis. 1 per konter × jumlah konter aktif).

---

## 4. Uji jalur kritis: pembuatan penumpang & cek cekal

Jalur paling sensitif (cek daftar cekal + tulis + audit dalam satu transaksi):

```bash
# Buat 200 penumpang unik, 20 paralel
hey -n 200 -c 20 -m POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Uji Beban","passport_number":"LOADTEST0001","nationality":"Indonesia","direction":"arrival"}' \
  "$BASE/passengers/"
```

Catat p95 dan pastikan tidak ada `5xx`. Ingat: setiap penumpang unik butuh
`passport_number` berbeda — buat variasi atau kirim satu per satu via skrip.

---

## 5. Uji MRZ (CPU-bound)

Siapkan 1 foto paspor contoh (`test-paspor.jpg`), lalu:

```bash
TOKEN="$(curl -s -X POST "$BASE/auth/login" \
  -d "username=$USER&password=$PASS" -H 'Content-Type: application/x-www-form-urlencoded' \
  | jq -r .access_token)"

hey -n 30 -c 3 -m POST \
  -H "Authorization: Bearer $TOKEN" \
  -T image/jpeg -D test-paspor.jpg \
  "$BASE/passengers/scan-mrz"
```

Perhatikan: OCR dibatasi **maksimal 3 job paralel** (semaphore) dan punya timeout
(`MRZ_PROCESSING_TIMEOUT`). Jika `-c` jauh lebih besar dari 3, permintaan akan
mengantre — ini perilaku yang diinginkan agar CPU tidak jenuh.

---

## 6. Analisis bundle frontend

```bash
./scripts/bundle_report.sh
```

Menampilkan ukuran tiap chunk (mentah + gzip) dari `frontend/dist/assets`.
Untuk peta visual opsional:

```bash
cd frontend
npx vite build --mode production
npx --yes rollup-plugin-visualizer --open dist/stats.html   # atau tambahkan plugin bila perlu
```

---

## 7. Baca latensi dari log aplikasi

Log request terstruktur (JSON bila `LOG_FORMAT=json`) memuat `duration_ms` per request:

```bash
docker logs imigrasi_backend --since 10m 2>&1 | grep duration_ms
```

Bandingkan `duration_ms` endpoint yang lambat dengan hasil `hey`/`k6`.

---

## 8. Pantau resource container

```bash
docker stats imigrasi_backend
```

Perhatikan CPU saat MRZ berjalan dan penggunaan RAM per worker. Sesuaikan
`WEB_CONCURRENCY` bila perlu (tiap worker memuat stack OCR).

---

## 9. Target metrik yang disarankan

| Operasi | Target p95 (indikatif) |
|---------|------------------------|
| `/auth/login` | < 500 ms (Argon2id disengaja lambat) |
| `/passengers/` (25/hal) | < 300 ms |
| `/passengers/dashboard/agent` | < 300 ms |
| `/escalations/dashboard/supervisor` | < 400 ms |
| `/reports/passengers/stats` | < 600 ms |
| `/reports/audit-logs` (50/hal) | < 400 ms |
| `/passengers/scan-mrz` | < 5 s (tergantung kualitas gambar/CPU) |

Angka ini indikatif; sesuaikan dengan perangkat dan volume data Anda.

## 10. Cara mencatat & membandingkan

1. Simpan semua hasil ke `reports/` dengan timestamp.
2. Catat konteks: versi image, jumlah baris tabel, spesifikasi server, jumlah worker.
3. Ubah **satu variabel** per percobaan (mis. tambah indeks, ubah `WEB_CONCURRENCY`).
4. Bandingkan p50/p95/p99 dan throughput sebelum vs sesudah.

Contoh tabel hasil:

```
Tanggal | Versi | Endpoint            | c  | RPS  | p95(ms) | error%
--------|-------|---------------------|----|------|---------|-------
...     | 2.0.0 | /passengers/        | 20 | ...  | ...     | 0
```
