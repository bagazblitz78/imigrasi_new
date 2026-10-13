import { Button } from "./Button";
import { Spinner } from "./Spinner";

export function EmptyState({ icon = "🗂", title = "Belum ada data", text, action }) {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="state__title">{title}</div>
      {text && <p className="state__text">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Terjadi kesalahan", error, onRetry }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden="true">
        ⚠
      </div>
      <div className="state__title">{title}</div>
      <p className="state__text">{error?.message || "Silakan coba beberapa saat lagi."}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div style={{ padding: 16 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="skeleton skeleton--row"
          style={{ opacity: 1 - r * 0.08, height: 38 }}
        />
      ))}
      <span className="visually-hidden">
        <Spinner /> Memuat data…
      </span>
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid--stats">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton--card" />
      ))}
    </div>
  );
}
