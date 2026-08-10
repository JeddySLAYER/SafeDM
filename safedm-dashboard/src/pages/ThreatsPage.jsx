import { useCallback, useEffect, useState } from "react";
import { getThreats, updateThreatStatus } from "../services/adminApi";

const STATUSES = ["ACTIVE", "UNDER_REVIEW", "DISMISSED"];

export default function ThreatsPage() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (page = 1) => {
    setError("");
    try {
      const res = await getThreats({
        page,
        pageSize: 20,
        status: status || undefined,
      });
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }, [status]);

  useEffect(() => {
    load(1);
  }, [load]);

  async function changeStatus(id, next) {
    setBusyId(id);
    try {
      await updateThreatStatus(id, next);
      await load(data.page || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Menaces</h1>
      <p className="muted">Modération des menaces communautaires</p>

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

      {error ? <p className="error">{error}</p> : null}

      <div className="table-wrap">
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
                <td>{t.id}</td>
                <td>
                  <span className={`pill sev-${t.severity?.toLowerCase()}`}>
                    {t.severity}
                  </span>
                </td>
                <td>{t.status}</td>
                <td>{t.report_count}</td>
                <td className="clip">{t.content}</td>
                <td className="actions">
                  {STATUSES.filter((s) => s !== t.status).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="btn small"
                      disabled={busyId === t.id}
                      onClick={() => changeStatus(t.id, s)}
                    >
                      {s}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button
          type="button"
          className="btn ghost"
          disabled={data.page <= 1}
          onClick={() => load(data.page - 1)}
        >
          Précédent
        </button>
        <span>
          Page {data.page} · {data.total} total
        </span>
        <button
          type="button"
          className="btn ghost"
          disabled={data.page * data.page_size >= data.total}
          onClick={() => load(data.page + 1)}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
