import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createMlDatasetFromReviewQueue,
  getReport,
  getReports,
  listReportTrainingQueue,
  removeReportFromTrainingQueue,
  reviewReportForTraining,
  withdrawReport,
} from "../services/adminApi";
import {
  Alert,
  BusyButton,
  EmptyState,
  Freshness,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
  ConfirmDialog,
  DetailSheet,
} from "../components/ui";

const STATUSES = ["ACTIVE", "WITHDRAWN"];

export default function ReportsPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawId, setWithdrawId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("report");
  const [selectedExpected, setSelectedExpected] = useState("");
  const [trainingQueue, setTrainingQueue] = useState([]);
  const [datasetName, setDatasetName] = useState(`signalements-relus-${new Date().toISOString().slice(0, 10)}`);
  const [createdDataset, setCreatedDataset] = useState(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  const [queueLoading, setQueueLoading] = useState(true);

  const loadTrainingQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const result = await listReportTrainingQueue();
      setTrainingQueue(result.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => { loadTrainingQueue(); }, [loadTrainingQueue]);

  const load = useCallback(async (page = 1, { soft = false } = {}) => {
    setError("");
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await getReports({
        page,
        pageSize: 20,
        status: status || undefined,
      });
      setData(res);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    load(1);
  }, [load]);

  async function onWithdraw(id) {
    setBusyId(id);
    try {
      await withdrawReport(id);
      await load(data.page || 1, { soft: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setWithdrawId(null);
    }
  }

  async function openReport(id) {
    setSelectedId(id);
    setSelected(null);
    setSelectedTab("report");
    setSelectedLoading(true);
    try {
      const report = await getReport(id);
      setSelected(report);
      setSelectedExpected(trainingQueue.find((item) => item.report_id === report.id)?.expected || "");
    } catch (err) {
      setError(err.message);
      setSelectedId(null);
    } finally {
      setSelectedLoading(false);
    }
  }

  function closeReport() {
    setSelectedId(null);
    setSelected(null);
    setSelectedLoading(false);
  }

  async function addSelectedToTrainingQueue() {
    if (!selected?.content || !selectedExpected || selected.status !== "ACTIVE") return;
    setQueueBusy(true);
    setError("");
    try {
      await reviewReportForTraining(selected.id, selectedExpected);
      await loadTrainingQueue();
      setCreatedDataset(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueBusy(false);
    }
  }

  async function removeFromTrainingQueue(reportId) {
    setQueueBusy(true);
    try {
      await removeReportFromTrainingQueue(reportId);
      await loadTrainingQueue();
    } catch (err) { setError(err.message); }
    finally { setQueueBusy(false); }
  }

  async function createTrainingDataset() {
    if (!trainingQueue.length || !trainingQueue.every((item) => item.status === "ACTIVE" && item.content_available) || queueBusy) return;
    setQueueBusy(true);
    setError("");
    try {
      const result = await createMlDatasetFromReviewQueue(datasetName);
      setCreatedDataset(result);
      await loadTrainingQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setQueueBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Signalements"
        subtitle="Examinez le contenu stocké, annotez-le, puis constituez un jeu relu avant l’entraînement."
        actions={
          <>
            <Freshness updatedAt={updatedAt} refreshing={refreshing} />
            <button type="button" className="btn ghost" disabled={refreshing} onClick={() => load(data.page || 1, { soft: true })}>Actualiser</button>
          </>
        }
      />

      <section className="panel report-training-queue">
        <div className="report-training-queue-heading">
          <div>
            <strong>File de revue</strong>
            <span className="pill soft">{trainingQueue.length}</span>
          </div>
          <p className="muted">Les labels sont enregistrés en base. Seuls les signalements actifs avec texte peuvent former un jeu.</p>
        </div>
        {queueLoading ? <span className="muted">Chargement de la file…</span> : null}
        {!queueLoading && trainingQueue.length === 0 ? <p className="muted">Aucun signalement relu pour l’instant. Ouvre une ligne avec « Lire et annoter ».</p> : null}
        {trainingQueue.some((item) => item.status !== "ACTIVE" || !item.content_available) ? <Alert tone="warn">Retire de la file les signalements retirés ou sans texte avant de créer le jeu.</Alert> : null}
        {trainingQueue.length ? <div className="report-dataset-controls">
          <label htmlFor="report-dataset-name">Nom du jeu</label>
          <div className="report-dataset-create">
            <input id="report-dataset-name" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
            <BusyButton className="btn primary" busy={queueBusy} busyLabel="Création…" disabled={!datasetName.trim() || !trainingQueue.every((item) => item.status === "ACTIVE" && item.content_available)} onClick={createTrainingDataset}>Créer le jeu</BusyButton>
          </div>
        </div> : null}
        {createdDataset ? <p className="report-dataset-created muted">Jeu #{createdDataset.id} créé. <Link to="/training">Ouvrir Entraînement</Link></p> : null}
        {trainingQueue.length ? <ul className="report-training-queue-list">{trainingQueue.map((item) => <li key={item.report_id}><span className="report-queue-label">#{item.report_id} · <strong>{item.expected === "malicious" ? "Malveillant" : "Bénin"}</strong></span><span className="report-queue-preview">{item.status !== "ACTIVE" ? "Signalement retiré" : item.threat_preview || "Texte indisponible"}</span><button type="button" className="btn small ghost" disabled={queueBusy} onClick={() => removeFromTrainingQueue(item.report_id)}>Retirer</button></li>)}</ul> : null}
      </section>

      <div className="toolbar">
        <label>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ACTIVE" ? "Actif" : "Retiré"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      {loading ? (
        <div className="panel">
          <Spinner label="Chargement des signalements…" />
          <Skeleton rows={6} />
        </div>
      ) : (
        <>
          <section className="report-list" aria-label="Liste des signalements">
            <LoadingOverlay show={refreshing} />
            {data.items.length === 0 ? (
              <EmptyState
                title="Aucun signalement"
                description="Changez le filtre ou attendez les premiers reports utilisateurs."
              />
            ) : (
              <div className="report-card-list">
                {data.items.map((r) => {
                  const queued = trainingQueue.find((item) => item.report_id === r.id);
                  return <article className="report-card" key={r.id}>
                    <div className="report-card-top">
                      <div className="report-card-title"><strong>Signalement #{r.id}</strong><span className={`pill sev-${String(r.severity).toLowerCase()}`}>{r.severity}</span><span className={`report-status ${r.status === "ACTIVE" ? "is-active" : ""}`}>{r.status === "ACTIVE" ? "Actif" : "Retiré"}</span></div>
                      <span className="report-card-source">{r.source} · {r.username || "Utilisateur inconnu"}</span>
                    </div>
                    <div className="report-card-content">{r.content_available ? <p>{r.threat_preview || "Contenu stocké · ouvrir pour lire"}</p> : <p className="muted"><strong>Contenu non stocké</strong> · signalement par empreinte</p>}</div>
                    <div className="report-card-bottom">
                      <div className="report-card-meta"><Link to={`/threats/${r.threat_id}`}>Menace #{r.threat_id}</Link>{queued ? <span className="pill soft">Relu · {queued.expected === "malicious" ? "Malveillant" : "Bénin"}</span> : <span className="muted">À relire</span>}</div>
                      <div className="report-card-actions">
                        <button type="button" className="btn small primary" onClick={() => openReport(r.id)}>{r.content_available ? "Lire et annoter" : "Voir les détails"}</button>
                        {r.status === "ACTIVE" ? <button type="button" className="btn small danger" disabled={busyId === r.id} onClick={() => setWithdrawId(r.id)}>{busyId === r.id ? <span className="btn-spinner" /> : null}Retirer</button> : null}
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            )}
            <ConfirmDialog
              open={withdrawId !== null}
              title="Retirer ce signalement ?"
              message="Le signalement passera à l’état WITHDRAWN et ne sera plus traité comme actif."
              confirmLabel="Retirer"
              danger
              busy={busyId === withdrawId}
              onCancel={() => setWithdrawId(null)}
              onConfirm={() => onWithdraw(withdrawId)}
            />
          </section>
      <DetailSheet open={selectedId !== null} title={selected ? `Signalement #${selected.id}` : selectedId ? `Signalement #${selectedId}` : "Signalement"} eyebrow="Revue admin" loading={selectedLoading} onClose={closeReport}>
        {selected ? <div className="report-detail">
          <div
            className="report-detail-tabs"
            role="tablist"
            aria-label="Sections du signalement"
            onKeyDown={(event) => {
              if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const order = ["report", "training"];
              const index = order.indexOf(selectedTab);
              const next = event.key === "Home" ? order[0] : event.key === "End" ? order[order.length - 1] : order[(index + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) + order.length) % order.length];
              setSelectedTab(next);
              document.getElementById(`report-tab-${next}`)?.focus();
            }}
          >
            <button id="report-tab-report" type="button" role="tab" aria-selected={selectedTab === "report"} aria-controls="report-panel-report" tabIndex={selectedTab === "report" ? 0 : -1} className={selectedTab === "report" ? "active" : ""} onClick={() => setSelectedTab("report")}>Signalement</button>
            <button id="report-tab-training" type="button" role="tab" aria-selected={selectedTab === "training"} aria-controls="report-panel-training" tabIndex={selectedTab === "training" ? 0 : -1} className={selectedTab === "training" ? "active" : ""} onClick={() => setSelectedTab("training")}>Annotation</button>
          </div>
          {selectedTab === "report" ? <div id="report-panel-report" role="tabpanel" aria-labelledby="report-tab-report" tabIndex={0} className="report-panel">
            <dl className="report-detail-meta">
              <div><dt>Utilisateur</dt><dd>{selected.username || "Inconnu"} (#{selected.user_id})</dd></div>
              <div><dt>Source</dt><dd>{selected.source || "—"}</dd></div>
              <div><dt>Statut · sévérité</dt><dd>{selected.status === "ACTIVE" ? "Actif" : "Retiré"} · {selected.severity}</dd></div>
              <div><dt>Reçu le</dt><dd>{new Date(selected.created_at).toLocaleString("fr-FR")}</dd></div>
              {selected.withdrawn_at ? <div><dt>Retiré le</dt><dd>{new Date(selected.withdrawn_at).toLocaleString("fr-FR")}</dd></div> : null}
              <div><dt>Revue communauté</dt><dd>{selected.report_count} signalement(s) · score {selected.community_score ?? "—"}</dd></div>
            </dl>
            {selected.content ? <section className="report-detail-message"><h3>Message signalé</h3><pre className="report-content">{selected.content}</pre></section> : <Alert tone="info">Contenu non stocké (signalement par empreinte). Cette entrée ne peut pas servir de message d’entraînement.</Alert>}
            <p className="report-detail-fp">Faux positif : <strong>{selected.false_positive ? "Oui" : "Non"}</strong></p>
            <div className="form-actions"><Link className="btn ghost" to={`/threats/${selected.threat_id}`}>Ouvrir la menace #{selected.threat_id}</Link>{selected.status === "ACTIVE" ? <button type="button" className="btn danger" onClick={() => setWithdrawId(selected.id)}>Retirer ce signalement</button> : null}</div>
          </div> : <div id="report-panel-training" role="tabpanel" aria-labelledby="report-tab-training" tabIndex={0} className="report-training-review">
            <h3>Label de référence</h3>
            {selected.content && selected.status === "ACTIVE" ? <>
              <p className="muted">Lis le message puis choisis la classe. Le signalement seul ne détermine pas le label.</p>
              <label>Étiquette relue<select value={selectedExpected} onChange={(event) => setSelectedExpected(event.target.value)}><option value="">À annoter…</option><option value="malicious">Malveillant</option><option value="legitimate">Bénin</option></select></label>
              <BusyButton className="btn primary" busy={queueBusy} busyLabel="Enregistrement…" disabled={!selectedExpected} onClick={addSelectedToTrainingQueue}>{trainingQueue.some((item) => item.report_id === selected.id) ? "Mettre à jour l’étiquette" : "Enregistrer le label en base"}</BusyButton>
            </> : <Alert tone="info">Ce signalement n’a pas de contenu réutilisable ou n’est plus actif. Il ne peut pas être ajouté à un jeu.</Alert>}
          </div>}
        </div> : null}
      </DetailSheet>

          <div className="pager">
            <button
              type="button"
              className="btn ghost"
              disabled={data.page <= 1 || refreshing}
              onClick={() => load(data.page - 1, { soft: true })}
            >
              Précédent
            </button>
            <span>
              Page {data.page} · {data.total} total
            </span>
            <button
              type="button"
              className="btn ghost"
              disabled={
                data.page * (data.page_size || 20) >= data.total || refreshing
              }
              onClick={() => load(data.page + 1, { soft: true })}
            >
              Suivant
            </button>
          </div>
        </>
      )}
    </div>
  );
}
