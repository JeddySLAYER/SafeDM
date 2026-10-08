import { useCallback, useEffect, useState } from "react";
import { PageHeader, Spinner, Alert } from "../components/ui";
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
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {docs.map((doc) => (
          <button
            key={doc.slug}
            type="button"
            className={doc.slug === selected ? "btn" : "btn ghost"}
            onClick={() => apply(docs, doc.slug)}
          >
            {doc.title}
          </button>
        ))}
      </div>
      <form onSubmit={onSave} className="card" style={{ padding: 16 }}>
        <p style={{ marginTop: 0 }}>Version actuelle : {version}</p>
        <label>
          Titre
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Texte
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            required
            style={{ width: "100%", marginTop: 8 }}
          />
        </label>
        <button className="btn" type="submit" disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
