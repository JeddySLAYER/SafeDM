import { useCallback, useEffect, useState } from "react";
import { getLinkGateEvents } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

const DECISIONS = ["ALLOW", "WARN", "BLOCK"];

export default function LinkGatePage() {
  const [decision, setDecision] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (page = 1, { soft = false } = {}) => {
      setError("");
      if (soft) setRefreshing(true);
      else setLoading(true);
      try {
        setData(
          await getLinkGateEvents({
            page,
            pageSize: 20,
            decision: decision || undefined,
          }),
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [decision],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Link Gate"
        subtitle="Journal des décisions ALLOW / WARN / BLOCK (URL + score, pas le contenu de page)."
      />
      <div className="toolbar">
        <label>
          Décision
          <select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">Toutes</option>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
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
          <Spinner label="Chargement…" />
          <Skeleton rows={5} />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <LoadingOverlay show={refreshing} />
            {data.items.length === 0 ? (
              <EmptyState
                title="Aucun événement"
                description="Les vérifications de liens depuis l’app apparaîtront ici."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Décision</th>
                    <th>Score</th>
                    <th>User</th>
                    <th>Domaine</th>
                    <th>URL</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td>
                        <span className="pill soft">{e.decision}</span>
                      </td>
                      <td>{e.risk_score}</td>
                      <td>{e.username || e.user_id || "—"}</td>
                      <td>{e.domain || "—"}</td>
                      <td className="clip" title={e.url}>
                        {e.url}
                      </td>
                      <td>
                        {e.created_at
                          ? new Date(e.created_at).toLocaleString("fr-FR")
                          : "—"}
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
