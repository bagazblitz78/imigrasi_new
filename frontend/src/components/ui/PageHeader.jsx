export function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumbs && <div className="breadcrumbs">{breadcrumbs}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
