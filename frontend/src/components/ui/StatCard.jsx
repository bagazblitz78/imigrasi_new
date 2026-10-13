export function StatCard({ label, value, sub, icon, accent = "var(--color-primary)" }) {
  return (
    <div className="stat" style={{ borderLeftColor: accent }}>
      <div>
        <div className="stat__label">{label}</div>
        <div className="stat__value">{value ?? "—"}</div>
        {sub && <div className="stat__sub">{sub}</div>}
      </div>
      {icon && (
        <div className="stat__icon" aria-hidden="true">
          {icon}
        </div>
      )}
    </div>
  );
}
