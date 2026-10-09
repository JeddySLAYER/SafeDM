import { useEffect } from "react";
import { X } from "lucide-react";

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function CheckboxField({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

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

export function DetailSheet({ open, title, eyebrow = "Fiche détaillée", loading = false, error = "", onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-sheet-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="detail-sheet-title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer la fiche">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="detail-sheet-body">
          {loading ? <Spinner label="Chargement de la fiche…" /> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          {!loading && !error ? children : null}
        </div>
      </aside>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmer", danger = false, busy = false, onCancel, onConfirm }) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Confirmation</p>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p className="confirm-dialog-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>Annuler</button>
          <button type="button" className={`btn ${danger ? "danger" : "primary"}`} disabled={busy} onClick={onConfirm}>
            {busy ? <span className="btn-spinner" /> : null}
            {busy ? "Traitement…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
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

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table" role="status" aria-label="Chargement des données">
      {Array.from({ length: rows }).map((_, row) => (
        <div className="skeleton-table-row" key={row}>
          {Array.from({ length: columns }).map((_, column) => (
            <div className="skeleton-line" key={column} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Freshness({ updatedAt, refreshing }) {
  if (!updatedAt) return null;
  return (
    <span className="freshness" aria-live="polite">
      {refreshing ? "Actualisation…" : `Mis à jour à ${new Date(updatedAt).toLocaleTimeString("fr-FR")}`}
    </span>
  );
}

export function HelpSheet({ open, title, sections, onClose }) {
  if (!open) return null;
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="help-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="help-sheet-header">
          <div>
            <p className="eyebrow">Aide contextuelle</p>
            <h2 id="help-sheet-title">{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer l’aide">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="help-sheet-body">
          {sections.map((section) => (
            <section className="help-section" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </aside>
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
