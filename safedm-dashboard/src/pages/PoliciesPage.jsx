import { useCallback, useEffect, useState } from "react";
import { PageHeader, Spinner, Alert, Field } from "../components/ui";
import { getLegalDocuments, updateLegalDocument } from "../services/adminApi";

export default function PoliciesPage() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState("privacy");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const apply = useCallback((list, slug) => {
    const doc = list.find((item) => item.slug === slug) || list[0];
    if (!doc) return;
    setSelected(doc.slug);
    setTitle(doc.title);
    setBody(doc.body);
    setVersion(doc.version);
  }, []);

  useEffect(() => {
    getLegalDocuments()
      .then((list) => {
        setDocs(list || []);
        apply(list || [], "privacy");
      })
      .catch((err) => setError(err.message || "Chargement impossible"))
      .finally(() => setLoading(false));
  }, [apply]);

  async function onSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await updateLegalDocument(selected, { title, body });
      setVersion(saved.version);
      setMessage("Enregistré. Les téléphones devront accepter cette nouvelle version.");
      const list = await getLegalDocuments();
      setDocs(list || []);
    } catch (err) {
      setError(err.message || "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Politiques"
        subtitle="Texte affiché dans l'application au moment du consentement."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="ok">{message}</Alert> : null}
      <div className="form-actions">
        {docs.map((doc) => (
          <button
            key={doc.slug}
            type="button"
            className={doc.slug === selected ? "btn primary" : "btn ghost"}
            onClick={() => apply(docs, doc.slug)}
          >
            {doc.title}
          </button>
        ))}
      </div>
      <form onSubmit={onSave} className="panel form-grid">
        <p className="muted">Version actuelle : {version}</p>
        <Field label="Titre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Texte affiché dans l’application">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16} required />
        </Field>
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
