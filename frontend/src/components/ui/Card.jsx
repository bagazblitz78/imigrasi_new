export function Card({ children, className = "", pad = false, ...rest }) {
  return (
    <div className={`card ${pad ? "card--pad" : ""} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, actions, children }) {
  return (
    <div className="card__header">
      <div className="card__title">{title}</div>
      {actions || children}
    </div>
  );
}

export function CardBody({ children, className = "" }) {
  return <div className={`card__body ${className}`}>{children}</div>;
}
