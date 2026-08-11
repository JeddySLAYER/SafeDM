import { useCallback, useEffect, useState } from "react";
import {
  createApplication,
  deleteApplication,
  getApplications,
  updateApplication,
} from "../services/adminApi";
import {
  Alert,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

export default function ApplicationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    package_name: "",
    is_enabled: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await getApplications());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createApplication(form);
      setForm({ name: "", package_name: "", is_enabled: true });
      setMessage("Application ajoutée.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(app) {
    setBusyId(app.id);
    try {
      await updateApplication(app.id, { is_enabled: !app.is_enabled });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!window.confirm("Supprimer cette application du catalogue ?")) return;
    setBusyId(id);
    try {
      await deleteApplication(id);
      setMessage("Application supprimée.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Catalogue des packages Android surveillables (aligné sur la table supported_applications)."
      />
      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert tone="ok" onDismiss={() => setMessage("")}>
        {message}
      </Alert>

      <div className="grid-2">
        <form className="panel form-grid" onSubmit={onCreate}>
          <h2>Ajouter</h2>
          <label>
            Nom
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="WhatsApp"
            />
          </label>
          <label>
            Package
            <input
              value={form.package_name}
              onChange={(e) =>
                setForm({ ...form, package_name: e.target.value })
              }
              required
              placeholder="com.whatsapp"
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={(e) =>
                setForm({ ...form, is_enabled: e.target.checked })
              }
            />
            Activée
          </label>
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? <span className="btn-spinner" /> : null}
            Créer
          </button>
        </form>

        <div className="panel">
          <h2>Catalogue ({items.length})</h2>
          {loading ? (
            <>
              <Spinner label="Chargement…" />
              <Skeleton rows={4} />
            </>
          ) : items.length === 0 ? (
            <EmptyState title="Aucune application" />
          ) : (
            <div className="table-wrap" style={{ border: "none" }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Package</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.name}</td>
                      <td className="clip" title={a.package_name}>
                        {a.package_name}
                      </td>
                      <td>
                        <span className={`pill ${a.is_enabled ? "soft" : "draft"}`}>
                          {a.is_enabled ? "ON" : "OFF"}
                        </span>
                      </td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn small"
                          disabled={busyId === a.id}
                          onClick={() => toggle(a)}
                        >
                          {busyId === a.id ? <span className="btn-spinner" /> : null}
                          {a.is_enabled ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          type="button"
                          className="btn small danger"
                          disabled={busyId === a.id}
                          onClick={() => remove(a.id)}
                        >
                          Suppr.
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
