export function Spinner({ size, className = "" }) {
  return (
    <span
      className={`spinner ${size === "lg" ? "spinner--lg" : ""} ${className}`}
      role="status"
      aria-label="Memuat"
    />
  );
}

export function CenteredSpinner({ label = "Memuat…" }) {
  return (
    <div className="spinner--center">
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <Spinner size="lg" />
        <span className="muted">{label}</span>
      </div>
    </div>
  );
}
