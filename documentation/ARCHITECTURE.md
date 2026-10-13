# Arsitektur

## 1. Gambaran umum

Aplikasi ini adalah **modular monolith**. Frontend SPA dan backend API adalah dua
artefak terpisah, namun backend tidak dipecah menjadi microservices karena beban kerja
tidak membenarkannya (menghindari overengineering). Satu database MariaDB menampung
seluruh data.

```
React SPA ──/imigrasi/api/*──► Nginx ──► FastAPI (Gunicorn+Uvicorn) ──► MariaDB
```

## 2. Komponen backend

| Lapisan | Lokasi | Tanggung jawab |
|---------|--------|----------------|
| API | `app/api/v1/endpoints` | Routing, validasi input, otorisasi, HTTP |
| Schemas | `app/schemas` | Kontrak request/response & validasi Pydantic |
| Services | `app/services` | Logika bisnis lintas entitas (auth, blacklist, MRZ, notifikasi, audit, upload) |
| Repositories | `app/repositories` | Akses data & query terpusat (pagination, filter, agregasi) |
| Models | `app/models` | Pemetaan SQLAlchemy (skema lama dipertahankan) |
| Core | `app/core` | Config, DB, keamanan, rate limit, logging, error, middleware |

Aturan dependensi: **endpoint → service/repository → model**. Endpoint tidak menulis
query kompleks; service tidak menangani HTTP.

### Middleware (urutan: dalam → luar)

1. `SecurityHeadersMiddleware` — header keamanan respons (defense-in-depth).
2. `RequestLoggingMiddleware` — request-id, durasi, status, redaksi body sensitif.
3. `CORSMiddleware` — origin terbatas, credentials.

### Penanganan error

Semua error dikembalikan konsisten:

```json
{"error": {"code": "not_found", "message": "...", "details": null, "request_id": "..."}}
```

Stack trace / detail internal tidak pernah bocor ke klien; dicatat di server.

## 3. Alur autentikasi

```
POST /auth/login ──► verifikasi Argon2 ──► access JWT (15 m, header Authorization)
                                      └──► refresh token opaque (cookie HttpOnly)
                                      └──► CSRF token (cookie terbaca + body)

request API ──► 401 ──► POST /auth/refresh (cookie + X-CSRF-Token)
                    └──► rotasi refresh (tiket lama dicabut) ──► access baru
```

- Access token disimpan **di memori** SPA (tidak di localStorage/sessionStorage).
- Refresh token di-hash (SHA-256) di tabel `refresh_tokens`, punya masa berlaku,
  dapat dicabut, dan **dirotasi setiap pemakaian**.
- Penyalahgunaan refresh token (memakai token yang sudah dicabut) mencabut seluruh
  keluarga token milik user.
- Cookie `SameSite=Strict` + CSRF double-submit melindungi dari CSRF.
- Logout & ganti password mencabut refresh token (paksa login ulang).

## 4. Model data

```
counters ──1:N──► users ──1:N──► passengers
  ▲                                    │ 1:1
  │                                    ├────────► escalations
  └────────────────────────────────────┤
                                       └────────► voa_applications

users ──1:N──► audit_logs
users ──1:N──► refresh_tokens
users ──1:N──► notifications
login_attempts (rate limit bersama)
```

Status penumpang: `PENDING → APPROVED | HOLD | DEPORTED | REJECTED`.
Keputusan eskalasi memetakan langsung ke status penumpang.

## 5. Alur bisnis inti

### Pemrosesan penumpang + daftar cekal

```
Agent isi/pindai MRZ → POST /passengers
      │
      ├─ cek daftar cekal (indeks, ternormalisasi)
      ├─ tidak kena → status PENDING (dapat disetujui agent)
      └─ kena       → status HOLD + Escalation otomatis + notifikasi SSE ke supervisor
```

> **Perbaikan dari kode lama:** pada implementasi lama, penumpang blacklist diset HOLD
> tetapi eskalasi tidak otomatis dibuat sehingga supervisor tidak pernah menerima
> kasusnya. Sekarang eskalasi + notifikasi dibuat otomatis dalam transaksi yang sama.

### Eskalasi

```
Hold → POST /escalations → notifikasi supervisor
     → supervisor PATCH /escalations/{id}/decide (approved/deported/rejected)
     → update status penumpang + audit + notifikasi balik ke agent
```

### VOA

```
Agent POST /voa → supervisor PATCH /voa/{id}/decide → notifikasi agent
```

### Notifikasi real-time

`POST /notifications/stream-ticket` (auth header) → tiket sekali pakai (30 detik) →
`GET /notifications/stream?ticket=...` (SSE). JWT tidak pernah muncul di URL. Setiap
notifikasi juga dipersist ke tabel `notifications` (riwayat + unread).

## 6. Struktur frontend

```
src/
├── api/         # client terpusat + definisi endpoint
├── app/         # App router + guard (RequireAuth, RoleRoute)
├── components/  # UI kit (Button, Modal, Field, Table, Badge, …)
├── contexts/    # AuthContext
├── features/    # per-domain: auth, dashboard, scanner, passengers, escalations, voa,
│                #            counters, blacklist, users, reports, audit, notifications
├── hooks/       # useApiQuery (cache + cancellation), useSessionManager, useOnlineStatus
├── layouts/     # AppLayout, Sidebar, navConfig
├── pages/       # NotFound, Forbidden
├── styles/      # tokens.css + global.css
└── utils/       # format, masking, i18n
```

- **Server state** dikelola `useApiQuery` (cache + stale time + `AbortController`),
  bukan satu store global. **Auth state** di Context. **UI/form state** lokal.
- **Code splitting** per-route dengan `React.lazy` + `Suspense`.
- Navigasi difilter berdasarkan role (`navConfig`) — tetapi otorisasi sebenarnya
  tetap di backend.

## 7. Keputusan desain penting

| Keputusan | Alasan |
|-----------|--------|
| Monolith modular, tanpa Kafka/GraphQL/K8s | Beban kerja tidak membenarkan kompleksitas |
| Rate limit di DB, bukan Redis | Enforcement bersama antar worker tanpa menambah dependensi |
| Refresh token opaque + rotasi | Memungkinkan revokasi & deteksi reuse (JWT murni tidak) |
| Kolom blacklist ternormalisasi | Pencocokan cepat + indeks, bukan `ILIKE` full scan |
| Migrasi baseline idempoten | Menyerap database lama tanpa merusak data |
| Tiket SSE sekali pakai | `EventSource` tidak bisa kirim header; hindari JWT di URL |
| CSS design system biasa | Menghindari UI library besar; bundle kecil & kontrol penuh |
