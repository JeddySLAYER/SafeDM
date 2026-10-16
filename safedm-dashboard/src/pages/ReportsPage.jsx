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
  EmptyState,
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
  const [selectedExpected, setSelectedExpected] = useState("");
  const [trainingQueue, setTrainingQueue] = useState([]);
  const [datasetName, setDatasetName] = useState(`signalements-relus-${new Date().toISOString().slice(0, 10)}`);
  const [createdDataset, setCreatedDataset] = useState(null);
  const [queueBusy, setQueueBusy] = useState(false);

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
        subtitle="Examinez le contenu stocké, annotez-le, puis constituez un dataset relu avant l’entraînement."
      />

      <section className="panel report-training-queue">
        <div className="report-training-queue-heading">
          <strong>File de revue enregistrée en base · {trainingQueue.length}</strong>
          <p className="muted">Labels conservés sur le serveur. Seuls les signalements actifs avec texte peuvent être ajoutés.</p>
        </div>
        {queueLoading ? <span className="muted">Chargement de la file…</span> : null}
        {!queueLoading && trainingQueue.length === 0 ? <p className="muted">Aucun signalement relu pour l’instant. Ouvre une ligne avec « Lire et annoter ».</p> : null}
        {trainingQueue.some((item) => item.status !== "ACTIVE" || !item.content_available) ? <Alert>Retire de la file les signalements retirés ou sans texte avant de créer le dataset.</Alert> : null}
        {trainingQueue.length ? <>
          <input aria-label="Nom du dataset" value={datasetName} onChange={(event) => setDatasetName(event.target.value)} />
          <button type="button" className="btn primary" disabled={queueBusy || !datasetName.trim() || !trainingQueue.every((item) => item.status === "ACTIVE" && item.content_available)} onClick={createTrainingDataset}>
            {queueBusy ? "Enregistrement…" : `Créer un dataset (${trainingQueue.length})`}
          </button>
        </> : null}
        {createdDataset ? <span className="muted">Dataset #{createdDataset.id} créé. <Link to="/training">Ouvrir Entraînement</Link></span> : null}
        {trainingQueue.length ? <ul className="report-training-queue-list">{trainingQueue.map((item) => <li key={item.report_id}><span>Signalement #{item.report_id} · <strong>{item.expected === "malicious" ? "Malveillant" : "Bénin"}</strong> · {item.status !== "ACTIVE" ? "Retiré" : item.threat_preview || "Texte indisponible"}</span><button type="button" className="btn small ghost" disabled={queueBusy} onClick={() => removeFromTrainingQueue(item.report_id)}>Retirer</button></li>)}</ul> : null}
      </section>

      <div className="toolbar">
        <label>
          Statut
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
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
          <div className="table-wrap">
            <LoadingOverlay show={refreshing} />
            {data.items.length === 0 ? (
              <EmptyState
                title="Aucun signalement"
                description="Changez le filtre ou attendez les premiers reports utilisateurs."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Source</th>
                    <th>Sévérité</th>
                    <th>Statut</th>
                    <th>Menace</th>
                    <th>Contenu</th>
                    <th>Label entraînement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.username}</td>
                      <td>{r.source}</td>
                      <td>
                        <span
                          className={`pill sev-${String(r.severity).toLowerCase()}`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td>{r.status}</td>
                      <td><Link className="btn small ghost" to={`/threats/${r.threat_id}`}>#{r.threat_id}</Link></td>
                      <td>{r.content_available ? r.threat_preview : <span className="muted">Contenu non stocké (empreinte)</span>}</td>
                      <td>{trainingQueue.find((item) => item.report_id === r.id) ? <span className="pill soft">{trainingQueue.find((item) => item.report_id === r.id).expected === "malicious" ? "Malveillant" : "Bénin"}</span> : <span className="muted">À relire</span>}</td>
                      <td className="actions">
                        <button type="button" className="btn small primary" onClick={async () => { setSelected(null); setSelectedExpected(""); try { const report = await getReport(r.id); setSelected(report); setSelectedExpected(trainingQueue.find((item) => item.report_id === report.id)?.expected || ""); } catch (err) { setError(err.message); } }}>{r.content_available ? "Lire et annoter" : "Détails"}</button>
                        {r.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={busyId === r.id}
                            onClick={() => setWithdrawId(r.id)}
                          >
                            {busyId === r.id ? <span className="btn-spinner" /> : null}
                            Retirer
                          </button>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          </div>
      <DetailSheet open={Boolean(selected)} title={selected ? `Signalement #${selected.id}` : "Signalement"} eyebrow="Revue admin" onClose={() => setSelected(null)}>
        {selected ? <div className="form-grid"><p><strong>Utilisateur :</strong> {selected.username} (#{selected.user_id}) · <strong>Source :</strong> {selected.source}</p><p><strong>Statut :</strong> {selected.status} · <strong>Sévérité :</strong> {selected.severity}</p><p><strong>Date :</strong> {new Date(selected.created_at).toLocaleString("fr-FR")}{selected.withdrawn_at ? ` · Retiré le ${new Date(selected.withdrawn_at).toLocaleString("fr-FR")}` : ""} · <strong>Signalements menace :</strong> {selected.report_count} · <strong>Score communauté :</strong> {selected.community_score}</p>{selected.content ? <div><h3>Contenu complet</h3><pre className="report-content">{selected.content}</pre></div> : <Alert>Contenu non stocké (signalement par empreinte). Cette entrée ne peut pas servir de message d’entraînement.</Alert>}<p>Faux positif : {selected.false_positive ? "Oui" : "Non"} · Menace #{selected.threat_id}</p><Link className="btn ghost" to={`/threats/${selected.threat_id}`}>Ouvrir la fiche menace</Link>{selected.content && selected.status === "ACTIVE" ? <div className="report-training-review"><h3>Ajouter à la file d’entraînement</h3><p className="muted">Choisis le label après lecture. Le fait qu’un utilisateur ait signalé le message ne décide pas du label.</p><label>Étiquette relue<select value={selectedExpected} onChange={(event) => setSelectedExpected(event.target.value)}><option value="">À annoter…</option><option value="malicious">Malveillant</option><option value="legitimate">Bénin</option></select></label><button type="button" className="btn primary" disabled={!selectedExpected || queueBusy} onClick={addSelectedToTrainingQueue}>{queueBusy ? "Enregistrement…" : trainingQueue.some((item) => item.report_id === selected.id) ? "Mettre à jour l’étiquette" : "Enregistrer le label en base"}</button></div> : null}{selected.status === "ACTIVE" ? <button type="button" className="btn danger" onClick={() => setWithdrawId(selected.id)}>Retirer ce signalement</button> : null}</div> : null}
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
