import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getThreat,
  updateThreatSeverity,
  updateThreatStatus,
} from "../services/adminApi";
import {
  Alert,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

const STATUSES = ["ACTIVE", "UNDER_REVIEW", "DISMISSED"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ThreatDetailPage() {
  const { threatId } = useParams();
  const [threat, setThreat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setThreat(await getThreat(threatId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [threatId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(next) {
    setBusy(true);
    try {
      await updateThreatStatus(threat.id, next);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setSeverity(next) {
    setBusy(true);
    try {
      await updateThreatSeverity(threat.id, next);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Menace" subtitle="Chargement…" />
        <Spinner label="Chargement…" />
        <Skeleton rows={6} />
      </div>
    );
  }

  if (!threat) {
    return (
      <div>
        <PageHeader title="Menace" />
        <Alert tone="error">{error || "Introuvable"}</Alert>
        <Link className="btn" to="/threats">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Menace #${threat.id}`}
        subtitle={`${threat.report_count} signalement(s) · score communauté ${threat.community_score}`}
        actions={
          <Link className="btn ghost" to="/threats">
            Retour
          </Link>
        }
      />
      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      <div className="grid-2">
        <div className="panel">
          <h2>Contenu</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{threat.content}</p>
          <p className="muted" style={{ marginTop: 12, fontSize: "0.8rem" }}>
            raw: {threat.raw_hash?.slice(0, 16)}… · norm:{" "}
            {threat.normalized_hash?.slice(0, 16)}…
          </p>
          <p className="muted" style={{ fontSize: "0.8rem" }}>
            Première vue :{" "}
            {threat.first_seen_at
              ? new Date(threat.first_seen_at).toLocaleString("fr-FR")
              : "—"}{" "}
            · Dernière :{" "}
            {threat.last_seen_at
              ? new Date(threat.last_seen_at).toLocaleString("fr-FR")
              : "—"}
          </p>
        </div>

        <div className="panel">
          <h2>Modération</h2>
          <p>
            Statut actuel : <strong>{threat.status}</strong>
          </p>
          <div className="actions" style={{ marginBottom: 14 }}>
            {STATUSES.filter((s) => s !== threat.status).map((s) => (
              <button
                key={s}
                type="button"
                className="btn small"
                disabled={busy}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <p>
            Sévérité :{" "}
            <span className={`pill sev-${String(threat.severity).toLowerCase()}`}>
              {threat.severity}
            </span>
          </p>
          <div className="actions">
            {SEVERITIES.filter((s) => s !== threat.severity).map((s) => (
              <button
                key={s}
                type="button"
                className="btn small"
                disabled={busy}
                onClick={() => setSeverity(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>URLs & VirusTotal</h2>
        {(threat.urls || []).length === 0 ? (
          <EmptyState title="Aucune URL liée" />
        ) : (
          threat.urls.map((u) => (
            <div key={u.id} style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>{u.domain || "domaine ?"}</strong>
              </p>
              <p className="clip" title={u.original_url} style={{ margin: "0 0 8px" }}>
                {u.original_url}
              </p>
              {(u.scans || []).length === 0 ? (
                <p className="muted">Aucun scan VT stocké</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Scan</th>
                      <th>Status</th>
                      <th>Résultat</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.scans.map((s) => (
                      <tr key={s.id}>
                        <td>#{s.id}</td>
                        <td>{s.status}</td>
                        <td>{s.result}</td>
                        <td>
                          {s.scanned_at
                            ? new Date(s.scanned_at).toLocaleString("fr-FR")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
