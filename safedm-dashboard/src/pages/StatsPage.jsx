import { useMemo } from "react";
import { useAdminStats } from "../hooks/useAdminStats";
import {
  Alert,
  EmptyState,
  PageHeader,
  SkeletonCards,
  Spinner,
  Freshness,
} from "../components/ui";

export default function StatsPage() {
  const { data: stats, error, loading, refreshing, updatedAt, refresh } = useAdminStats();
  const modelMetrics = stats?.model_metrics || {};
  const latencyMs =
    typeof window !== "undefined" ? window.__safedmLastApiMs ?? null : null;
  const maxDay = useMemo(
    () =>
      Math.max(
        1,
        ...(stats?.reports_last_7_days || []).map(
          (d) => d.reports + d.threats,
        ),
      ),
    [stats],
  );

  if (error && !stats) {
    return (
      <div>
        <PageHeader title="Stats" subtitle="Indicateurs SafeDM" />
        <Alert tone="error">{error}</Alert>
        <button type="button" className="btn primary" onClick={() => refresh()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div>
        <PageHeader title="Stats" subtitle="Indicateurs SafeDM" />
        <Spinner label="Chargement…" />
        <SkeletonCards count={8} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <PageHeader title="Stats" subtitle="Indicateurs SafeDM" />
        <Alert tone="error">
          Les statistiques sont indisponibles. Vérifiez votre connexion et vos droits administrateur.
        </Alert>
        <button type="button" className="btn primary" onClick={() => refresh()}>
          Réessayer
        </button>
      </div>
    );
  }

  const cards = [
    { label: "Utilisateurs", value: stats.users_count },
    { label: "Signalements actifs", value: stats.reports_active_count },
    { label: "Signalements retirés", value: stats.reports_withdrawn_count },
    { label: "Menaces actives", value: stats.threats_active_count },
    { label: "Sous revue", value: stats.threats_under_review_count ?? 0 },
    { label: "Menaces rejetées", value: stats.threats_dismissed_count },
    { label: "Articles publiés", value: stats.guide_articles_published },
    { label: "Apps supportées", value: stats.supported_applications },
    { label: "Link Gate (events)", value: stats.link_gate_events_count ?? 0 },
    {
      label: "Rappel modèle",
      value: modelMetrics.recall == null ? "N/D" : `${(modelMetrics.recall * 100).toFixed(1)}%`,
    },
    {
      label: "Faux positifs",
      value:
        modelMetrics.false_positive_rate == null
          ? "N/D"
          : `${(modelMetrics.false_positive_rate * 100).toFixed(1)}%`,
    },
  ];

  const health = stats.provider_health;

  return (
    <div>
      <PageHeader
        title="Stats"
        subtitle="Activité, providers et tendances (7 jours)."
        actions={
          <>
            <Freshness updatedAt={updatedAt} refreshing={refreshing} />
            <button type="button" className="btn" onClick={() => refresh()} disabled={refreshing}>
              {refreshing ? <span className="btn-spinner" /> : null}
              Actualiser
            </button>
          </>
        }
      />
      {latencyMs != null ? (
        <p className="req-meta">Dernière requête stats : {latencyMs} ms</p>
      ) : null}
      <Alert tone="error">{error}</Alert>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="stat-value">{c.value}</p>
            <p className="stat-label">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Providers</h2>
          {health ? (
            <ul className="health-list">
              <li className="health-row">
                <span>Jev (TypeSafe)</span>
                <span className={`health-badge ${health.jev_ok ? "ok" : "warn"}`}>
                  {health.jev_ok ? "OK" : "Manquant"}
                </span>
              </li>
              <li className="health-row">
                <span>VirusTotal</span>
                <span
                  className={`health-badge ${health.virustotal_ok ? "ok" : "warn"}`}
                >
                  {health.virustotal_ok ? "OK" : "Manquant"}
                </span>
              </li>
              <li className="health-row">
                <span>Mode démo</span>
                <span className="health-badge warn">
                  {health.analysis_demo_mode ? "Oui" : "Non"}
                </span>
              </li>
            </ul>
          ) : (
            <ul className="plain-list">
              <li>Jev : {stats.jev_configured ? "oui" : "non"}</li>
              <li>VirusTotal : {stats.virustotal_configured ? "oui" : "non"}</li>
            </ul>
          )}
        </div>

        <div className="panel">
          <h2>Sévérité (actives)</h2>
          {(stats.severity_distribution || []).length === 0 ? (
            <EmptyState title="Aucune menace active" />
          ) : (
            <ul className="plain-list">
              {stats.severity_distribution.map((b) => (
                <li key={b.severity}>
                  <span className={`pill sev-${String(b.severity).toLowerCase()}`}>
                    {b.severity}
                  </span>{" "}
                  {b.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>7 derniers jours</h2>
        {(stats.reports_last_7_days || []).length === 0 ? (
          <EmptyState title="Pas de données" />
        ) : (
          <div className="bars">
            {(stats.reports_last_7_days || []).map((d) => {
              const total = d.reports + (d.threats || 0);
              const h = Math.round((total / maxDay) * 100);
              return (
                <div
                  key={d.day}
                  className="bar-col"
                  title={`${d.day}: ${d.reports} sig. / ${d.threats || 0} menaces`}
                >
                  <div className="bar" style={{ height: `${Math.max(3, h)}%` }} />
                  <span className="bar-label">{d.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>Top menaces</h2>
        {(stats.top_reported_threats || []).length === 0 ? (
          <EmptyState title="Pas encore de menaces" />
        ) : (
          <div className="table-wrap" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Sévérité</th>
                  <th>Reports</th>
                  <th>Aperçu</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_reported_threats.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>
                      <span className={`pill sev-${String(t.severity).toLowerCase()}`}>
                        {t.severity}
                      </span>
                    </td>
                    <td>{t.report_count}</td>
                    <td className="clip">{t.preview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
