# Migrasi Database (Alembic)

Sistem **tidak** memakai `Base.metadata.create_all()` untuk mengelola skema di
produksi. Semua perubahan skema diverifikasi lewat Alembic, version-controlled, dan
aman terhadap data.

## 1. Struktur

```
backend/
├── alembic.ini
└── migrations/
    ├── env.py
    ├── script.py.mako
    └── versions/
        ├── 0001_baseline.py             # 7 tabel lama (idempoten)
        └── 0002_security_and_indexes.py # tabel keamanan + kolom normalisasi + indeks
```

`env.py` membaca `DATABASE_URL` dari konfigurasi aplikasi (driver sinkron `pymysql`
khusus migrasi; runtime aplikasi memakai `aiomysql`).

## 2. Menjalankan migrasi

```bash
# Lokal (dari folder backend, sudah ada .env)
alembic upgrade head

# Docker (produksi)
docker compose -f docker-compose.prod.yml run --rm migrate
```

Cek status & riwayat:

```bash
alembic current
alembic history --verbose
```

## 3. Adopsi database lama (sudah ada data)

Database lama dibuat lewat `create_all` sehingga **tidak punya tabel `alembic_version`**.
Karena `0001_baseline` bersifat idempoten (memeriksa keberadaan tabel via inspector dan
hanya membuat yang belum ada), cukup jalankan sekali:

```bash
alembic upgrade head
```

Efek:
- Tabel lama **tidak disentuh**; data tetap utuh.
- `0002_security` menambahkan:
  - kolom `blacklists.passport_normalized`, `blacklists.name_normalized` + **backfill**
    (`UPDATE … REGEXP_REPLACE …`) hanya untuk baris yang belum terisi;
  - kolom `audit_logs.request_id`;
  - tabel `refresh_tokens`, `login_attempts`, `notifications`;
  - semua indeks performa (hanya bila belum ada).

> Jika database Anda sudah punya tabel `alembic_version` dari sistem lain, tinjau
> `alembic current` dan pertimbangkan `alembic stamp 0001_baseline` sebelum upgrade.

## 4. Menambah migrasi baru

```bash
cd backend
alembic revision -m "add X"
```

Tulis `upgrade()`/`downgrade()` secara eksplisit. Untuk kompatibilitas data:

- **Add-only** lebih disukai (kolom nullable, tabel baru, indeks `IF NOT EXISTS`-style).
- Hindari `DROP`/rename kolom tanpa langkah backfill bertahap.
- Untuk kolom nullable baru, isi data lama lalu (opsional) tambahkan NOT NULL pada
  migrasi berikutnya setelah kode lama pensiun.
- Uji di salinan database sebelum produksi.

Contoh idempoten (aman dijalankan pada DB yang mungkin sudah punya objeknya):

```python
from sqlalchemy import inspect

def upgrade():
    bind = op.get_bind()
    cols = {c["name"] for c in inspect(bind).get_columns("passengers")}
    if "new_col" not in cols:
        op.add_column("passengers", sa.Column("new_col", sa.String(32), nullable=True))
```

## 5. Aturan keselamatan

- `downgrade()` pada `0001`/`0002` **sengaja no-op** (tidak pernah menghapus data produksi).
- Migrasi produksi harus **eksplisit**, bukan dijalankan otomatis di startup.
- Jangan pernah gabungkan drop tabel + deploy aplikasi baru dalam satu langkah tanpa
  backup.
- Selalu backup sebelum menjalankan migrasi di produksi.

## 6. CI

Alur yang disarankan:

```
1. CI: jalankan alembic upgrade head pada DB uji bersih (integrasi)
2. CI: jalankan alembic upgrade head pada salinan skema lama (regresi migrasi)
3. Deploy: jalankan service migrate sebelum backend start
4. Verifikasi: aplikasi start & /health/ready = 200
```
