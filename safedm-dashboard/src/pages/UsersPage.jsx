import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUser, getUsers } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  LoadingOverlay,
  PageHeader,
  Skeleton,
  Spinner,
  DetailSheet,
} from "../components/ui";

export default function UsersPage() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function load(page = 1, { soft = false } = {}) {
    setError("");
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      setData(await getUsers({ page, pageSize: 20 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(1);
  }, []);

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      setDetail(await getUser(id));
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Comptes, rôle admin, appareils et monitoring — ouvrez une fiche pour gérer."
      />
      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      {loading ? (
        <div className="panel">
          <Spinner label="Chargement des utilisateurs…" />
          <Skeleton rows={6} />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <LoadingOverlay show={refreshing} />
            {data.items.length === 0 ? (
              <EmptyState title="Aucun utilisateur" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Rôle</th>
                    <th>Appareils</th>
                    <th>Signalements</th>
                    <th>Créé</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>
                        <span className={`pill ${u.is_admin ? "soft" : "draft"}`}>
                          {u.is_admin ? "Admin" : "User"}
                        </span>
                      </td>
                      <td>{u.devices_count}</td>
                      <td>{u.reports_count}</td>
                      <td>
                        {u.created_at
                          ? new Date(u.created_at).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                      <td>
                        <button type="button" className="btn small" disabled={detailId === u.id && detailLoading} onClick={() => openDetail(u.id)}>
                          {detailId === u.id && detailLoading ? <span className="btn-spinner" /> : null}
                          {detailId === u.id && detailLoading ? "Ouverture…" : "Aperçu"}
                        </button>
                        <Link className="btn small ghost" to={`/users/${u.id}`}>Fiche complète</Link>
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
      <DetailSheet
        open={detailId !== null}
        title={detail ? detail.username : "Utilisateur"}
        loading={detailLoading}
        error={detailError}
        onClose={() => setDetailId(null)}
      >
        {detail ? (
          <>
            <div className="detail-summary">
              <span className="user-avatar">{detail.username.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{detail.username}</strong>
                <p className="muted">Compte #{detail.id} · {detail.is_admin ? "Administrateur" : "Utilisateur"}</p>
              </div>
            </div>
            <dl className="details-list">
              <div><dt>Signalements</dt><dd>{detail.reports_count}</dd></div>
              <div><dt>Appareils</dt><dd>{detail.devices?.length || 0}</dd></div>
              <div><dt>Applications surveillées</dt><dd>{detail.monitoring?.length || 0}</dd></div>
              <div><dt>Créé le</dt><dd>{detail.created_at ? new Date(detail.created_at).toLocaleString("fr-FR") : "—"}</dd></div>
            </dl>
            <Link className="btn primary" to={`/users/${detail.id}`}>Ouvrir la fiche complète</Link>
          </>
        ) : null}
      </DetailSheet>
    </div>
  );
}
