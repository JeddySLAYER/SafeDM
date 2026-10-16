import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { flagThreatFalsePositive, getThreat, getThreats, updateThreatStatus } from "../services/adminApi";
import {
  Alert,
  BusyButton,
  EmptyState,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
  DetailSheet,
} from "../components/ui";

const STATUSES = ["ACTIVE", "UNDER_REVIEW", "DISMISSED"];
const STATUS_LABELS = { ACTIVE: "Active", UNDER_REVIEW: "À examiner", DISMISSED: "Écartée" };

export default function ThreatsPage() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async (page = 1, { soft = false } = {}) => {
    setError("");
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getThreats({ page, pageSize: 20, status: status || undefined });
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { load(1); }, [load]);

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await getThreat(id));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(id, next) {
    setBusyAction(`status-${next}`);
    setError("");
    try {
      await updateThreatStatus(id, next);
      await Promise.all([load(data.page || 1, { soft: true }), getThreat(id).then(setDetail)]);
    } catch (err) {
      setError(err.message);
      setDetailError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  async function markFalsePositive(id) {
    setBusyAction("false-positive");
    setError("");
    try {
      await flagThreatFalsePositive(id);
      await Promise.all([load(data.page || 1, { soft: true }), getThreat(id).then(setDetail)]);
    } catch (err) {
      setError(err.message);
      setDetailError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div>
      <PageHeader title="Menaces" subtitle="Examinez le contenu, les signalements associés et l’activité des URLs, puis choisissez une action de modération." />

      <div className="toolbar">
        <label>
          Statut
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tous les statuts</option>
            {STATUSES.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
        </label>
      </div>

      <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>

      {loading ? <div className="panel"><Spinner label="Chargement des menaces…" /><Skeleton rows={5} /></div> : <>
        <section className="threat-list" aria-label="Liste des menaces">
          <LoadingOverlay show={refreshing} />
          {!data.items.length ? <EmptyState title="Aucune menace" description="Changez le filtre ou attendez les prochains signalements." /> : (
            <div className="threat-card-list">
              {data.items.map((threat) => <article className="threat-card" key={threat.id}>
                <div className="threat-card-header">
                  <div className="threat-card-title">
                    <strong>Menace #{threat.id}</strong>
                    <span className={`pill sev-${String(threat.severity).toLowerCase()}`}>{threat.severity}</span>
                    <span className="pill">{STATUS_LABELS[threat.status] || threat.status}</span>
                    {threat.false_positive ? <span className="pill draft">Faux positif</span> : null}
                  </div>
                  <span className="muted">{threat.report_count} signalement(s) · score {threat.community_score}</span>
                </div>
                <div className="threat-card-content">
                  {threat.content_available || threat.content ? <p>{threat.content}</p> : <p className="muted"><strong>Contenu non stocké</strong> · empreinte seule</p>}
                </div>
                <div className="threat-card-footer">
                  <span className="muted">{threat.urls?.length || 0} URL(s) associée(s)</span>
                  <div className="threat-card-actions">
                    <button type="button" className="btn small primary" onClick={() => openDetail(threat.id)}>Examiner</button>
                    <Link className="btn small ghost" to={`/threats/${threat.id}`}>Fiche complète</Link>
                  </div>
                </div>
              </article>)}
            </div>
          )}
        </section>

        <div className="pager">
          <button type="button" className="btn ghost" disabled={data.page <= 1 || refreshing} onClick={() => load(data.page - 1, { soft: true })}>Précédent</button>
          <span>Page {data.page} · {data.total} menace(s)</span>
          <button type="button" className="btn ghost" disabled={data.page * (data.page_size || 20) >= data.total || refreshing} onClick={() => load(data.page + 1, { soft: true })}>Suivant</button>
        </div>
      </>}

      <DetailSheet
        open={detailId !== null}
        title={detail ? `Menace #${detail.id}` : detailId ? `Menace #${detailId}` : "Menace"}
        eyebrow="Revue et modération"
        loading={detailLoading}
        error={detailError}
        onClose={() => { setDetailId(null); setDetail(null); }}
      >
        {detail ? <div className="threat-review-sheet">
          <div className="detail-summary">
            <span className={`pill sev-${String(detail.severity).toLowerCase()}`}>{detail.severity}</span>
            <div><strong>{STATUS_LABELS[detail.status] || detail.status}</strong><p className="muted">{detail.report_count} signalement(s) · score communauté {detail.community_score}</p></div>
          </div>
          <section className="detail-content-preview">
            <h3>Contenu signalé</h3>
            {detail.content_available || detail.content ? <p>{detail.content}</p> : <Alert>Contenu non stocké. La revue est limitée à l’empreinte et aux métadonnées.</Alert>}
          </section>
          <dl className="details-list">
            <div><dt>Faux positif</dt><dd>{detail.false_positive ? "Oui" : "Non"}</dd></div>
            <div><dt>Première vue</dt><dd>{detail.first_seen_at ? new Date(detail.first_seen_at).toLocaleString("fr-FR") : "—"}</dd></div>
            <div><dt>Dernière vue</dt><dd>{detail.last_seen_at ? new Date(detail.last_seen_at).toLocaleString("fr-FR") : "—"}</dd></div>
            <div><dt>URLs associées</dt><dd>{detail.urls?.length || 0}</dd></div>
          </dl>
          {detail.urls?.length ? <div className="threat-url-chips">{detail.urls.map((url) => <span className="pill soft" key={url.id}>{url.domain || url.original_url}</span>)}</div> : null}
          <section className="threat-review-actions">
            <h3>Décision de modération</h3>
            <div className="actions">
              {STATUSES.filter((value) => value !== detail.status).map((value) => <BusyButton key={value} className="btn small" busy={busyAction === `status-${value}`} busyLabel="Mise à jour…" disabled={Boolean(busyAction)} onClick={() => changeStatus(detail.id, value)}>{STATUS_LABELS[value]}</BusyButton>)}
              {!detail.false_positive ? <BusyButton className="btn small danger" busy={busyAction === "false-positive"} busyLabel="Enregistrement…" disabled={Boolean(busyAction)} onClick={() => markFalsePositive(detail.id)}>Marquer faux positif</BusyButton> : null}
            </div>
          </section>
          <Link className="btn primary" to={`/threats/${detail.id}`}>Ouvrir la fiche complète</Link>
        </div> : null}
      </DetailSheet>
    </div>
  );
}
