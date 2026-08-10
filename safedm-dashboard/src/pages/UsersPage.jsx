import { useEffect, useState } from "react";
import { getUsers } from "../services/adminApi";

export default function UsersPage() {
  const [data, setData] = useState({ items: [], total: 0, page: 1 });
  const [error, setError] = useState("");

  async function load(page = 1) {
    setError("");
    try {
      setData(await getUsers({ page, pageSize: 20 }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  return (
    <div>
      <h1>Utilisateurs</h1>
      <p className="muted">Comptes inscrits sur SafeDM</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Rôle</th>
              <th>Appareils</th>
              <th>Signalements</th>
              <th>Créé</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.is_admin ? "Admin" : "User"}</td>
                <td>{u.devices_count}</td>
                <td>{u.reports_count}</td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleString("fr-FR") : "—"}</td>
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
