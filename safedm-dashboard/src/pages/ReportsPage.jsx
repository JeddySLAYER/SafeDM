import { useCallback, useEffect, useState } from "react";
import { getReports, withdrawReport } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

const STATUSES = ["ACTIVE", "WITHDRAWN"];

export default function ReportsPage() {
  const [status, setStatus] = useState("ACTIVE");
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    if (!window.confirm("Retirer ce signalement (WITHDRAWN) ?")) return;
    setBusyId(id);
    try {
      await withdrawReport(id);
      await load(data.page || 1, { soft: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Signalements"
        subtitle="Supervision communautaire — retirez un signalement abusif ou erroné."
      />

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
                      <td className="clip" title={r.threat_preview}>
                        #{r.threat_id} · {r.threat_preview}
                      </td>
                      <td className="actions">
                        {r.status === "ACTIVE" ? (
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={busyId === r.id}
                            onClick={() => onWithdraw(r.id)}
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
          </div>

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
