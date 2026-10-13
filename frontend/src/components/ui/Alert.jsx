const ICONS = { error: "⛔", success: "✓", warning: "⚠", info: "ℹ" };

export function Alert({ type = "info", children, onClose, title }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${type}`} role={type === "error" ? "alert" : "status"}>
      <span className="alert__icon" aria-hidden="true">
        {ICONS[type]}
      </span>
      <div className="alert__body">
        {title && <strong>{title}</strong>}
        {title ? <div>{children}</div> : children}
      </div>
      {onClose && (
        <button className="alert__close" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      )}
    </div>
  );
}
