export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="muted page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function Alert({ tone = "error", children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${tone}`} role="status">
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="alert-dismiss" onClick={onDismiss} aria-label="Fermer">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ label = "Chargement…" }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ rows = 4, className = "" }) {
  return (
    <div className={`skeleton-stack ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${88 - (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card skeleton-card">
          <div className="skeleton-line skeleton-value" />
          <div className="skeleton-line" style={{ width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {description ? <p className="muted">{description}</p> : null}
      {action || null}
    </div>
  );
}

export function LoadingOverlay({ show, label = "Actualisation…" }) {
  if (!show) return null;
  return (
    <div className="loading-overlay">
      <Spinner label={label} />
    </div>
  );
}
