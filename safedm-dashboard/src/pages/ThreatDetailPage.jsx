import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getThreat, updateThreatSeverity, updateThreatStatus } from "../services/adminApi";
import { Alert, BusyButton, EmptyState, PageHeader, Skeleton, Spinner } from "../components/ui";

const STATUSES = ["ACTIVE", "UNDER_REVIEW", "DISMISSED"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUS_LABELS = { ACTIVE: "Active", UNDER_REVIEW: "À examiner", DISMISSED: "Écartée" };
const SEVERITY_LABELS = { LOW: "Faible", MEDIUM: "Moyenne", HIGH: "Élevée", CRITICAL: "Critique" };

export default function ThreatDetailPage() {
  const { threatId } = useParams();
  const [threat, setThreat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [nextSeverity, setNextSeverity] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getThreat(threatId);
      setThreat(result);
      setNextStatus(result.status);
      setNextSeverity(result.severity);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [threatId]);

  useEffect(() => { load(); }, [load]);

  async function updateThreat(action, update) {
    setBusyAction(action);
    setError("");
    try {
      await update();
      const result = await getThreat(threat.id);
      setThreat(result);
      setNextStatus(result.status);
      setNextSeverity(result.severity);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  if (loading) return <div><PageHeader title="Menace" subtitle="Chargement de la fiche…" /><div className="panel"><Spinner label="Chargement…" /><Skeleton rows={6} /></div></div>;

  if (!threat) return (
    <div className="detail-fallback">
      <PageHeader title="Menace" />
      <Alert tone="error">{error || "Menace introuvable"}</Alert>
      <div className="actions">
        <button type="button" className="btn primary" onClick={load}>Réessayer</button>
        <Link className="btn ghost" to="/threats">Retour aux menaces</Link>
      </div>
    </div>
  );

  return (
    <div className="threat-detail-page">
      <PageHeader
        title={`Menace #${threat.id}`}
        subtitle={`${threat.report_count} signalement(s) · score communauté ${threat.community_score}`}
        actions={<Link className="btn ghost" to="/threats">Retour aux menaces</Link>}
      />
      <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>

      <section className="panel threat-primary-panel">
        <div className="threat-primary-heading">
          <div><p className="eyebrow">Contenu signalé</p><h2>Message et empreintes</h2></div>
          <div className="threat-primary-badges"><span className={`pill sev-${String(threat.severity).toLowerCase()}`}>{SEVERITY_LABELS[threat.severity] || threat.severity}</span><span className="pill">{STATUS_LABELS[threat.status] || threat.status}</span>{threat.false_positive ? <span className="pill draft">Faux positif</span> : null}</div>
        </div>
        {threat.content_available || threat.content ? <pre className="threat-message">{threat.content}</pre> : <Alert tone="info">Contenu non stocké (signalement par empreinte). La revue repose sur les métadonnées et les URLs associées.</Alert>}
        <dl className="threat-hashes">
          <div><dt>Empreinte de similarité</dt><dd>{threat.similarity_hash || "—"}</dd></div>
          <div><dt>Empreinte brute</dt><dd>{threat.raw_hash || "—"}</dd></div>
          <div><dt>Empreinte normalisée</dt><dd>{threat.normalized_hash || "—"}</dd></div>
        </dl>
      </section>

      <div className="threat-detail-grid">
        <section className="panel threat-moderation-panel">
          <div className="section-title"><h2>Modération</h2>{busyAction ? <span className="muted">Enregistrement…</span> : null}</div>
          <div className="threat-edit-field">
            <label htmlFor="threat-status">Statut</label>
            <select id="threat-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
              {STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
            </select>
            <BusyButton className="btn primary" busy={busyAction === "status"} busyLabel="Mise à jour…" disabled={nextStatus === threat.status || Boolean(busyAction)} onClick={() => updateThreat("status", () => updateThreatStatus(threat.id, nextStatus))}>Enregistrer le statut</BusyButton>
          </div>
          <div className="threat-edit-field">
            <label htmlFor="threat-severity">Sévérité</label>
            <select id="threat-severity" value={nextSeverity} onChange={(event) => setNextSeverity(event.target.value)}>
              {SEVERITIES.map((value) => <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>)}
            </select>
            <BusyButton className="btn" busy={busyAction === "severity"} busyLabel="Mise à jour…" disabled={nextSeverity === threat.severity || Boolean(busyAction)} onClick={() => updateThreat("severity", () => updateThreatSeverity(threat.id, nextSeverity))}>Enregistrer la sévérité</BusyButton>
          </div>
          <p className="muted compact-note">Les changements sont enregistrés sur la menace communautaire.</p>
        </section>

        <section className="panel threat-timeline-panel">
          <h2>Activité de la communauté</h2>
          <div className="threat-stat-row"><strong>{threat.report_count}</strong><span>signalement(s)</span></div>
          <div className="threat-stat-row"><strong>{threat.community_score}</strong><span>score communauté</span></div>
          <dl className="details-list">
            <div><dt>Première vue</dt><dd>{threat.first_seen_at ? new Date(threat.first_seen_at).toLocaleString("fr-FR") : "—"}</dd></div>
            <div><dt>Dernière vue</dt><dd>{threat.last_seen_at ? new Date(threat.last_seen_at).toLocaleString("fr-FR") : "—"}</dd></div>
          </dl>
        </section>
      </div>

      <section className="panel threat-urls-panel">
        <div className="section-title"><h2>URLs associées</h2><span className="pill soft">{threat.urls?.length || 0}</span></div>
        {!threat.urls?.length ? <EmptyState title="Aucune URL liée" description="Aucune URL n’a été extraite ou conservée pour cette menace." /> : <div className="threat-url-list">
          {threat.urls.map((url) => <article className="threat-url-card" key={url.id}>
            <div className="threat-url-heading"><div><strong>{url.domain || "Domaine inconnu"}</strong><p>{url.original_url}</p></div><span className="pill">{url.scans?.length || 0} scan(s)</span></div>
            {!url.scans?.length ? <p className="muted">Aucun résultat VirusTotal conservé pour cette URL.</p> : <div className="threat-scan-list" aria-label={`Scans pour ${url.domain || url.original_url}`}>
              {url.scans.map((scan) => <div className="threat-scan-row" key={scan.id}><span className="threat-scan-id">Scan #{scan.id}</span><span>{scan.status}</span><strong>{scan.result}</strong><time>{scan.scanned_at ? new Date(scan.scanned_at).toLocaleString("fr-FR") : "Date inconnue"}</time></div>)}
            </div>}
          </article>)}
        </div>}
      </section>
    </div>
  );
}
