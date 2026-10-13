import { Button } from "./Button";

export function Pagination({ page, pages, total, pageSize, onPageChange }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label="Navigasi halaman">
      <div className="pagination__info">
        Menampilkan <strong>{from}</strong>–<strong>{to}</strong> dari <strong>{total}</strong> data
      </div>
      <div className="pagination__controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          ← Sebelumnya
        </Button>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Hal. {page} / {pages || 1}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= (pages || 1)}
        >
          Berikutnya →
        </Button>
      </div>
    </nav>
  );
}
