import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, FolderPlus } from "lucide-react";
import {
  createArticle,
  createCategory,
  deleteArticle,
  deleteCategory,
  getArticle,
  getGuideCategories,
  updateArticle,
  updateCategory,
} from "../services/adminApi";
import {
  Alert,
  EmptyState,
  PageHeader,
  Skeleton,
  Spinner,
} from "../components/ui";

const emptyArticle = {
  category_id: "",
  title: "",
  content: "",
  is_published: true,
};

export default function GuidePage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorTab, setEditorTab] = useState("article");
  const [catForm, setCatForm] = useState({ title: "", description: "" });
  const [articleForm, setArticleForm] = useState(emptyArticle);
  const [editingId, setEditingId] = useState(null);
  const [editCatId, setEditCatId] = useState(null);
  const [editCatForm, setEditCatForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  const articleCount = useMemo(
    () => categories.reduce((n, c) => n + (c.articles?.length || 0), 0),
    [categories],
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const cats = await getGuideCategories();
      setCategories(cats || []);
      setArticleForm((f) =>
        f.category_id || !cats?.length
          ? f
          : { ...f, category_id: String(cats[0].id) },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(okMsg) {
    setMessage(okMsg);
    setError("");
  }

  async function onCreateCategory(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createCategory({
        title: catForm.title,
        description: catForm.description || null,
        display_order: 0,
      });
      setCatForm({ title: "", description: "" });
      flash("Catégorie créée.");
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveArticle(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        category_id: Number(articleForm.category_id),
        title: articleForm.title,
        content: articleForm.content,
        is_published: articleForm.is_published,
        display_order: 0,
      };
      if (editingId) {
        await updateArticle(editingId, payload);
        flash("Article mis à jour.");
      } else {
        await createArticle(payload);
        flash("Article créé.");
      }
      setEditingId(null);
      setArticleForm((f) => ({ ...emptyArticle, category_id: f.category_id }));
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function startEdit(article) {
    setEditorTab("article");
    setLoadingArticle(true);
    setError("");
    try {
      const full = await getArticle(article.id);
      setEditingId(full.id);
      setArticleForm({
        category_id: String(full.category_id),
        title: full.title,
        content: full.content,
        is_published: full.is_published,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingArticle(false);
    }
  }

  function resetArticleEditor() {
    setEditingId(null);
    setArticleForm((f) => ({
      ...emptyArticle,
      category_id: f.category_id || (categories[0] ? String(categories[0].id) : ""),
    }));
  }

  async function togglePublish(article) {
    setRowBusy(`pub-${article.id}`);
    try {
      await updateArticle(article.id, { is_published: !article.is_published });
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  async function removeArticle(id) {
    if (!window.confirm("Supprimer cet article ?")) return;
    setRowBusy(`del-a-${id}`);
    try {
      await deleteArticle(id);
      if (editingId === id) resetArticleEditor();
      flash("Article supprimé.");
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  function beginEditCategory(cat) {
    setEditCatId(cat.id);
    setEditCatForm({
      title: cat.title || "",
      description: cat.description || "",
    });
  }

  async function saveCategory(e) {
    e.preventDefault();
    if (!editCatId) return;
    setRowBusy(`cat-${editCatId}`);
    try {
      await updateCategory(editCatId, {
        title: editCatForm.title,
        description: editCatForm.description || null,
      });
      setEditCatId(null);
      flash("Catégorie mise à jour.");
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  async function removeCategory(id) {
    if (!window.confirm("Supprimer cette catégorie et ses articles ?")) return;
    setRowBusy(`del-c-${id}`);
    try {
      await deleteCategory(id);
      flash("Catégorie supprimée.");
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Guide"
        subtitle="Rédigez et publiez le contenu pédagogique visible dans l’app mobile — sans republier l’app."
        actions={
          <button
            type="button"
            className="btn ghost"
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : null}
            Actualiser
          </button>
        }
      />

      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert tone="ok" onDismiss={() => setMessage("")}>
        {message}
      </Alert>

      <div className="guide-layout">
        <section className="guide-catalog">
          <div className="guide-section-title">
            <h2 style={{ margin: 0 }}>Catalogue</h2>
            <span className="pill soft">
              {categories.length} cat. · {articleCount} art.
            </span>
          </div>

          {loading ? (
            <div className="panel">
              <Spinner label="Chargement du guide…" />
              <Skeleton rows={5} />
            </div>
          ) : categories.length === 0 ? (
            <div className="panel">
              <EmptyState
                title="Aucune catégorie"
                description="Créez une catégorie à droite, puis ajoutez vos premiers articles."
              />
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="guide-cat">
                {editCatId === cat.id ? (
                  <form onSubmit={saveCategory} className="form-grid" style={{ padding: 14 }}>
                    <label>
                      Titre catégorie
                      <input
                        value={editCatForm.title}
                        onChange={(e) =>
                          setEditCatForm({ ...editCatForm, title: e.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={editCatForm.description}
                        onChange={(e) =>
                          setEditCatForm({
                            ...editCatForm,
                            description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="form-actions">
                      <button
                        className="btn small primary"
                        type="submit"
                        disabled={rowBusy === `cat-${cat.id}`}
                      >
                        {rowBusy === `cat-${cat.id}` ? (
                          <span className="btn-spinner" />
                        ) : null}
                        Sauver
                      </button>
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => setEditCatId(null)}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="guide-cat-head">
                    <div>
                      <h3>{cat.title}</h3>
                      <p className="guide-cat-meta">
                        {cat.description || "Sans description"} ·{" "}
                        {(cat.articles || []).length} article
                        {(cat.articles || []).length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => beginEditCategory(cat)}
                      >
                        Éditer
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        disabled={rowBusy === `del-c-${cat.id}`}
                        onClick={() => removeCategory(cat.id)}
                      >
                        {rowBusy === `del-c-${cat.id}` ? (
                          <span className="btn-spinner" />
                        ) : null}
                        Suppr.
                      </button>
                    </div>
                  </div>
                )}

                {(cat.articles || []).length === 0 ? (
                  <p className="muted" style={{ padding: "12px 14px" }}>
                    Aucun article dans cette catégorie.
                  </p>
                ) : (
                  <ul className="article-list">
                    {(cat.articles || []).map((a) => (
                      <li
                        key={a.id}
                        className={editingId === a.id ? "active-edit" : undefined}
                      >
                        <div>
                          <div className="article-title-row">
                            <strong>{a.title}</strong>
                            <span
                              className={`pill ${a.is_published ? "soft" : "draft"}`}
                            >
                              {a.is_published ? "Publié" : "Brouillon"}
                            </span>
                          </div>
                        </div>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => startEdit(a)}
                            disabled={loadingArticle}
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            disabled={rowBusy === `pub-${a.id}`}
                            onClick={() => togglePublish(a)}
                          >
                            {rowBusy === `pub-${a.id}` ? (
                              <span className="btn-spinner" />
                            ) : null}
                            {a.is_published ? "Dépublier" : "Publier"}
                          </button>
                          <button
                            type="button"
                            className="btn small danger"
                            disabled={rowBusy === `del-a-${a.id}`}
                            onClick={() => removeArticle(a.id)}
                          >
                            {rowBusy === `del-a-${a.id}` ? (
                              <span className="btn-spinner" />
                            ) : null}
                            Suppr.
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>

        <aside className="guide-editor">
          <div className="panel">
            <div className="tabs" role="tablist">
              <button
                type="button"
                className={editorTab === "article" ? "tab active" : "tab"}
                onClick={() => setEditorTab("article")}
              >
                <FilePlus2 size={15} aria-hidden /> Article
              </button>
              <button
                type="button"
                className={editorTab === "category" ? "tab active" : "tab"}
                onClick={() => setEditorTab("category")}
              >
                <FolderPlus size={15} aria-hidden /> Catégorie
              </button>
            </div>

            {editorTab === "category" ? (
              <form className="form-grid" onSubmit={onCreateCategory}>
                <p className="panel-note">
                  Une catégorie regroupe les articles dans l’app (ex. Phishing, SMS).
                </p>
                <label>
                  Titre
                  <input
                    value={catForm.title}
                    onChange={(e) =>
                      setCatForm({ ...catForm, title: e.target.value })
                    }
                    placeholder="Ex. Liens suspects"
                    required
                  />
                </label>
                <label>
                  Description
                  <input
                    value={catForm.description}
                    onChange={(e) =>
                      setCatForm({ ...catForm, description: e.target.value })
                    }
                    placeholder="Courte intro visible dans le guide"
                  />
                </label>
                <button
                  className="btn primary block"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? <span className="btn-spinner" /> : null}
                  Créer la catégorie
                </button>
              </form>
            ) : loadingArticle ? (
              <div>
                <Spinner label="Ouverture de l’article…" />
                <Skeleton rows={4} />
              </div>
            ) : (
              <form className="form-grid" onSubmit={onSaveArticle}>
                <p className="panel-note">
                  {editingId
                    ? `Édition de l’article #${editingId}`
                    : "Nouvel article — le contenu apparaît dans le guide mobile dès publication."}
                </p>
                <label>
                  Catégorie
                  <select
                    value={articleForm.category_id}
                    onChange={(e) =>
                      setArticleForm({
                        ...articleForm,
                        category_id: e.target.value,
                      })
                    }
                    required
                    disabled={!categories.length}
                  >
                    {!categories.length ? (
                      <option value="">Créez d’abord une catégorie</option>
                    ) : null}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Titre
                  <input
                    value={articleForm.title}
                    onChange={(e) =>
                      setArticleForm({ ...articleForm, title: e.target.value })
                    }
                    placeholder="Titre clair et actionnable"
                    required
                    disabled={!categories.length}
                  />
                </label>
                <label>
                  Contenu
                  <textarea
                    rows={12}
                    value={articleForm.content}
                    onChange={(e) =>
                      setArticleForm({ ...articleForm, content: e.target.value })
                    }
                    placeholder="Rédigez le contenu pédagogique…"
                    required
                    disabled={!categories.length}
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={articleForm.is_published}
                    onChange={(e) =>
                      setArticleForm({
                        ...articleForm,
                        is_published: e.target.checked,
                      })
                    }
                    disabled={!categories.length}
                  />
                  Publier immédiatement
                </label>
                <div className="form-actions">
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={saving || !categories.length}
                  >
                    {saving ? <span className="btn-spinner" /> : null}
                    {editingId ? "Enregistrer" : "Créer l’article"}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={resetArticleEditor}
                      disabled={saving}
                    >
                      Nouveau
                    </button>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
