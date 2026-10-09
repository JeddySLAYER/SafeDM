import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import {
  createApplication,
  deleteApplication,
  getApplications,
  updateApplication,
} from "../services/adminApi";
import {
  Alert,
  CheckboxField,
  ConfirmDialog,
  DetailSheet,
  EmptyState,
  Field,
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
  const [deleteId, setDeleteId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);

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
      setAddOpen(false);
      setMessage("Application ajoutée au catalogue.");
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
      const next = { ...app, is_enabled: !app.is_enabled };
      setSelected(next);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    setBusyId(id);
    try {
      await deleteApplication(id);
      setSelected(null);
      setMessage("Application retirée du catalogue.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setDeleteId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Applications Android que le téléphone peut surveiller."
        actions={
          <button type="button" className="btn primary" onClick={() => setAddOpen(true)}>
            <Plus size={16} aria-hidden />
            Ajouter
          </button>
        }
      />
      <Alert tone="error" onDismiss={() => setError("")}>{error}</Alert>
      <Alert tone="ok" onDismiss={() => setMessage("")}>{message}</Alert>

      {loading ? (
        <div className="panel">
          <Spinner label="Chargement…" />
          <Skeleton rows={4} />
        </div>
      ) : items.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Aucune application"
            description="Ajoutez un nom et un package Android. L’app mobile proposera ensuite cette application."
          />
        </div>
      ) : (
        <ul className="catalog-list">
          {items.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                className={selected?.id === app.id ? "catalog-row is-selected" : "catalog-row"}
                onClick={() => setSelected(app)}
              >
                <span>
                  {app.name}
                  <small>{app.package_name}</small>
                </span>
                <span className={`pill ${app.is_enabled ? "soft" : "draft"}`}>
                  {app.is_enabled ? "Activée" : "Désactivée"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DetailSheet
        open={addOpen}
        title="Ajouter une application"
        eyebrow="Catalogue"
        onClose={() => setAddOpen(false)}
      >
        <form className="form-grid" onSubmit={onCreate}>
          <p className="panel-note">
            Le nom est celui affiché dans l’app. Le package est l’identifiant Android, par exemple com.whatsapp.
            Rien n’est créé avant l’enregistrement.
          </p>
          <Field label="Nom">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="WhatsApp"
            />
          </Field>
          <Field label="Package">
            <input
              value={form.package_name}
              onChange={(e) => setForm({ ...form, package_name: e.target.value })}
              required
              placeholder="com.whatsapp"
            />
          </Field>
          <CheckboxField
            label="Proposée à la surveillance dès maintenant"
            checked={form.is_enabled}
            onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })}
          />
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : null}
              Enregistrer
            </button>
          </div>
        </form>
      </DetailSheet>

      <DetailSheet
        open={Boolean(selected)}
        title={selected?.name || "Application"}
        eyebrow="Fiche application"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <>
            <p className="muted">Package</p>
            <p><code>{selected.package_name}</code></p>
            <p>
              {selected.is_enabled
                ? "Activée : le téléphone peut la proposer dans la surveillance."
                : "Désactivée : elle reste dans le catalogue, mais n’est plus proposée."}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={busyId === selected.id}
                onClick={() => toggle(selected)}
              >
                {selected.is_enabled ? "Désactiver" : "Activer"}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busyId === selected.id}
                onClick={() => setDeleteId(selected.id)}
              >
                Retirer du catalogue
              </button>
            </div>
          </>
        ) : null}
      </DetailSheet>

      <ConfirmDialog
        open={deleteId !== null}
        title="Retirer cette application ?"
        message="Elle ne sera plus proposée dans la surveillance. Les téléphones déjà configurés gardent leur réglage local."
        confirmLabel="Retirer"
        danger
        busy={busyId === deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => remove(deleteId)}
      />
    </div>
  );
}
