import { useEffect, useState } from "react";
import { getStats } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  PageHeader,
  SkeletonCards,
  Spinner,
} from "../components/ui";

const STATS_CACHE_KEY = "safedm_admin_stats_cache";
const STATS_TTL_MS = 20_000;

function readStatsCache() {
  try {
    const raw = sessionStorage.getItem(STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.at) return null;
    if (Date.now() - parsed.at > STATS_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStatsCache(data) {
  try {
    sessionStorage.setItem(
      STATS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data }),
    );
  } catch {
    /* ignore quota */
  }
}

export default function StatsPage() {
  const cached = readStatsCache();
  const [stats, setStats] = useState(cached);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!cached);
  const [latencyMs, setLatencyMs] = useState(null);

  async function load({ soft = false } = {}) {
    if (!soft) setLoading(!stats);
    setError("");
    try {
      const data = await getStats();
      setStats(data);
      writeStatsCache(data);
      setLatencyMs(
        typeof window !== "undefined" ? window.__safedmLastApiMs ?? null : null,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ soft: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error && !stats) {
    return (
      <div>
        <PageHeader title="Stats" subtitle="Indicateurs SafeDM" />
        <Alert tone="error">{error}</Alert>
        <button type="button" className="btn primary" onClick={() => load()}>
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
  ];

  const health = stats.provider_health;
  const maxDay = Math.max(
    1,
    ...(stats.reports_last_7_days || []).map((d) => d.reports + d.threats),
  );

  return (
    <div>
      <PageHeader
        title="Stats"
        subtitle="Activité, providers et tendances (7 jours)."
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => load({ soft: true })}
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : null}
            Actualiser
          </button>
        }
      />
      {latencyMs != null ? (
        <p className="req-meta">Dernière requête stats : {latencyMs} ms</p>
      ) : null}
      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

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
                <span>Gemini</span>
                <span className={`health-badge ${health.gemini_ok ? "ok" : "warn"}`}>
                  {health.gemini_ok ? "OK" : "Manquant"}
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
              <li>Gemini : {stats.gemini_configured ? "oui" : "non"}</li>
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
