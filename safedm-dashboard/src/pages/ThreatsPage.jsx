import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getThreats, updateThreatStatus } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

const STATUSES = ["ACTIVE", "UNDER_REVIEW", "DISMISSED"];

export default function ThreatsPage() {
  const [status, setStatus] = useState("");
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
      const res = await getThreats({
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

  async function changeStatus(id, next) {
    setBusyId(id);
    try {
      await updateThreatStatus(id, next);
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
        title="Menaces"
        subtitle="Modérez le statut des menaces communautaires (ACTIVE, revue, rejet)."
      />

      <div className="toolbar">
        <label>
          Filtrer par statut
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
          <Spinner label="Chargement des menaces…" />
          <Skeleton rows={6} />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <LoadingOverlay show={refreshing} />
            {data.items.length === 0 ? (
              <EmptyState
                title="Aucune menace"
                description="Les signalements utilisateurs apparaîtront ici."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Sévérité</th>
                    <th>Statut</th>
                    <th>Signalements</th>
                    <th>Contenu</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <Link to={`/threats/${t.id}`}>#{t.id}</Link>
                      </td>
                      <td>
                        <span className={`pill sev-${t.severity?.toLowerCase()}`}>
                          {t.severity}
                        </span>
                      </td>
                      <td>{t.status}</td>
                      <td>{t.report_count}</td>
                      <td className="clip" title={t.content}>
                        {t.content}
                      </td>
                      <td className="actions">
                        <Link className="btn small" to={`/threats/${t.id}`}>
                          Détail
                        </Link>
                        {STATUSES.filter((s) => s !== t.status).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="btn small"
                            disabled={busyId === t.id}
                            onClick={() => changeStatus(t.id, s)}
                          >
                            {busyId === t.id ? <span className="btn-spinner" /> : null}
                            {s}
                          </button>
                        ))}
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
