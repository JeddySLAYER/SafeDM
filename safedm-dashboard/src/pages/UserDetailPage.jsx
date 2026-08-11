import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUser, updateUser } from "../services/adminApi";
import {
  Alert,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

export default function UserDetailPage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUser(await getUser(userId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAdmin() {
    if (!user) return;
    const next = !user.is_admin;
    const ok = window.confirm(
      next
        ? `Promouvoir ${user.username} en administrateur ?`
        : `Retirer les droits admin de ${user.username} ?`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      setUser(await updateUser(user.id, { is_admin: next }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Utilisateur" subtitle="Chargement…" />
        <Spinner label="Chargement…" />
        <Skeleton rows={5} />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="Utilisateur" />
        <Alert tone="error">{error || "Introuvable"}</Alert>
        <Link className="btn" to="/users">
          Retour
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={user.username}
        subtitle={`Compte #${user.id} · créé ${user.created_at ? new Date(user.created_at).toLocaleString("fr-FR") : "—"}`}
        actions={
          <>
            <Link className="btn ghost" to="/users">
              Retour
            </Link>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={toggleAdmin}
            >
              {busy ? <span className="btn-spinner" /> : null}
              {user.is_admin ? "Retirer admin" : "Promouvoir admin"}
            </button>
          </>
        }
      />
      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>

      <div className="grid-2">
        <div className="panel">
          <h2>Profil</h2>
          <ul className="plain-list">
            <li>
              Rôle :{" "}
              <span className={`pill ${user.is_admin ? "soft" : "draft"}`}>
                {user.is_admin ? "Admin" : "User"}
              </span>
            </li>
            <li>Signalements : {user.reports_count}</li>
            <li>Appareils : {user.devices?.length || 0}</li>
          </ul>
        </div>

        <div className="panel">
          <h2>Appareils</h2>
          {(user.devices || []).length === 0 ? (
            <EmptyState title="Aucun appareil enregistré" />
          ) : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Identifiant</th>
                    <th>Vu</th>
                  </tr>
                </thead>
                <tbody>
                  {user.devices.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td className="clip">{d.device_identifier}</td>
                      <td>
                        {d.last_seen_at
                          ? new Date(d.last_seen_at).toLocaleString("fr-FR")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h2>Monitoring (apps surveillées)</h2>
        {(user.monitoring || []).length === 0 ? (
          <EmptyState title="Aucune préférence de monitoring" />
        ) : (
          <div className="table-wrap" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Package</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {user.monitoring.map((m) => (
                  <tr key={m.id}>
                    <td>{m.application?.name || m.application_id}</td>
                    <td className="clip">{m.application?.package_name}</td>
                    <td>
                      <span className={`pill ${m.enabled ? "soft" : "draft"}`}>
                        {m.enabled ? "ON" : "OFF"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
