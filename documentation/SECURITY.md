# Keamanan

Dokumen ini menjelaskan kontrol keamanan yang diterapkan dan perbaikan dibanding
sistem lama. Aplikasi menangani data paspor/imigrasi sehingga diperlakukan sebagai
sistem sensitif.

## 1. Autentikasi & sesi

- **Access token**: JWT HS256 berumur pendek (default 15 menit), berisi `sub`, `role`,
  `iss`, `aud`, `iat`, `nbf`, `exp`, `jti`, `type=access`.
- **Refresh token**: string acak 48 byte, **di-hash SHA-256** di DB, cookie
  `HttpOnly; Secure; SameSite=Strict`, **dirotasi setiap pemakaian**, dapat dicabut.
- **Deteksi reuse**: memakai refresh token yang sudah dicabut → seluruh token user dicabut.
- **Logout / ganti password / nonaktifkan user** mencabut semua refresh token.
- Validasi JWT ketat: algoritma di-*pin*, `issuer`/`audience` diverifikasi, `exp` & `sub`
  wajib ada, `type` dicek → mencegah *algorithm confusion* dan token palsu.
- Access token hanya di memori SPA — tidak pernah di `localStorage`/`sessionStorage`.

## 2. Proteksi CSRF

- Cookie refresh `SameSite=Strict` (tidak terkirim lintas situs).
- Endpoint refresh memakai **double-submit CSRF**: nilai cookie `imigrasi_csrf`
  (non-HttpOnly) harus sama dengan header `X-CSRF-Token` (dibandingkan `hmac.compare_digest`).
- API yang terdampak state-changing memakai header `Authorization` (tidak otomatis
  dikirim lintas situs oleh browser).

## 3. Password

- **Argon2id** (`time_cost=3`, `memory_cost=64MB`, `parallelism=2`) untuk hash baru.
- Hash **bcrypt lama tetap valid**; otomatis di-*rehash* ke Argon2id saat login berhasil.
- Kebijakan: minimal 8 karakter, minimal 3 dari 4 kelas karakter (huruf kecil/besar,
  angka, simbol), maksimal 128.
- Pesan gagal login **generik** (tidak membocorkan keberadaan username).
- Ganti password & reset oleh admin mencabut sesi; reset tidak memerlukan password lama
  tetapi hanya boleh oleh ADMIN.

## 4. Rate limiting login (terdistribusi)

- Disimpan di tabel `login_attempts` → berlaku **lintas worker & container**
  (memperbaiki kelemahan counter in-memory lama).
- Dua dimensi: **per IP** dan **per username** → menahan brute force, credential
  stuffing, dan password spraying.
- Default 5 percobaan gagal / 15 menit → respons `429` + `Retry-After`.
- Edge Nginx menambahkan `limit_req` pada endpoint login (defense-in-depth).
- Percobaan gagal **di-commit sebelum respons error** (bug lama: rollback menghapus jejak).

## 5. RBAC & otorisasi objek (anti-IDOR/BOLA)

- Setiap endpoint memakai dependency role eksplisit (`require_agent/supervisor/admin`).
- **Pemeriksaan objek** di `app/core/permissions.py`: agent hanya dapat melihat/mengubah
  penumpang miliknya; akses ke milik agent lain mengembalikan `404` (tidak membocorkan
  keberadaan data).
- Escalation/VOA diperiksa kepemilikan penumpangnya.
- Agent tidak dapat approve/deport/tolak (hanya supervisor/admin).
- Konter: agent hanya boleh mengubah status konternya sendiri.

## 6. Validasi input

- Semua body divalidasi Pydantic: panjang, pola, enum, rentang (mis. durasi VOA 1–365).
- Normalisasi nilai (paspor → alfanumerik uppercase; nama → spasi tunggal).
- Pagination dibatasi (maks. 100/halaman). Field `sort` **di-whitelist** (tidak ada
  fragmen SQL dari user). Filter memakai parameter binding SQLAlchemy.

## 7. Keamanan unggah berkas (MRZ)

- Validasi ukuran (≤ 8 MB), MIME deklarasi, **magic bytes** (JPEG/PNG/WEBP), dan
  kecocokan tipe-isi.
- `Image.verify()` menolak berkas rusak; batas dimensi & piksel (anti *decompression bomb*).
- Pemrosesan di memori (tidak menulis file ke disk), dijalankan di thread pool dengan
  timeout. Gambar **tidak pernah dikirim ke pihak ketiga**.

## 8. Perlindungan data sensitif

- Nomor paspor dimasking (`A123***78`) di log, CSV ekspor, dan pesan audit.
- Helper `mask_passport`/`mask_name`/`mask_email`.
- Middleware log meredaksi `password`, `token`, `refresh_token`, `ticket`, dll.
- Cookie `Secure` di produksi; konfigurasi produksi **fail-fast** bila `JWT_SECRET`,
  `DB_PASSWORD`, `ALLOWED_ORIGINS`, atau `COOKIE_SECURE` tidak aman.

## 9. Audit logging

- Tindakan keamanan & operasional dicatat append-oriented: login/logout, gagal login
  (rate limit), pembuatan/perubahan/approve/reject/deport penumpang, perubahan daftar
  cekal, eskalasi & keputusannya, keputusan VOA, perubahan user/role/password, tindakan admin.
- Setiap entri menyertakan `request_id` untuk korelasi dengan log request.
- Rahasia (password/token) **tidak pernah** masuk ke audit.

## 10. Header HTTP & CORS

- API: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `Cache-Control: no-store`.
- Nginx: menambahkan CSP, `frame-ancestors 'none'`, gzip, batas ukuran body, HSTS (setelah TLS).
- CORS hanya origin tepercaya; `allow_credentials=True` sehingga **wildcard dilarang**
  (divalidasi di config produksi).

## 11. Database & infrastruktur

- Akun DB least-privilege (`imigrasi_user`, hanya DB aplikasi).
- Kredensial via environment; tidak pernah dibakar ke image/source.
- DB **tidak mengekspos port** di jaringan publik pada compose produksi (`internal: true`).
- Backend container non-root, `read_only`, `no-new-privileges`, tmpfs terbatas.
- Migrasi terkontrol (Alembic), tanpa operasi destruktif otomatis saat startup.

## 12. Ringkasan temuan yang diperbaiki

| Temuan pada sistem lama | Perbaikan |
|-------------------------|-----------|
| Token JWT di `sessionStorage` & query URL SSE | Access token di memori; SSE pakai tiket sekali pakai |
| Rate limit in-memory (per worker) | Rate limit DB bersama antar worker + edge Nginx |
| Percobaan login gagal ter-rollback | Commit sebelum `raise` |
| Tidak ada refresh/revokasi sebenarnya | Refresh opaque + rotasi + deteksi reuse + revokasi |
| Blacklist `ILIKE` full table scan | Kolom ternormalisasi + indeks |
| Validasi upload hanya header MIME | Magic bytes + verify + batas dimensi/piksel |
| Agent dapat akses data agent lain | Object-level authorization (404) |
| Detail teknis berpotensi bocor | Error response konsisten & aman |
| `SECRET_KEY` default di source | Fail-fast + wajib env di produksi |
| CORS `allow_methods/headers=["*"]` | Daftar metode/header eksplisit |
| Cekal hanya `is_active` tanpa normalisasi | Backfill normalisasi aman + indeks |

## 13. Pelaporan kerentanan

Jika menemukan kerentanan, laporkan secara privat ke tim Pusdatin/administrator sistem;
jangan membuka issue publik yang memuat detail eksploitasi.
