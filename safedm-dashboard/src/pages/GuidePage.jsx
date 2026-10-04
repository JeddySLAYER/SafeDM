import { useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2, FolderPlus, Library, X } from "lucide-react";
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
  ConfirmDialog,
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
  const [preview, setPreview] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catForm, setCatForm] = useState({ title: "", description: "" });
  const [articleForm, setArticleForm] = useState(emptyArticle);
  const [editingId, setEditingId] = useState(null);
  const [editCatId, setEditCatId] = useState(null);
  const [editCatForm, setEditCatForm] = useState({ title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

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
      setConfirmAction(null);
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
    setRowBusy(`del-c-${id}`);
    try {
      await deleteCategory(id);
      flash("Catégorie supprimée.");
      await load({ silent: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setRowBusy(null);
      setConfirmAction(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Guide"
        subtitle="Rédigez et publiez le contenu pédagogique visible dans l’app mobile — sans republier l’app."
        actions={
          <>
            <button type="button" className="btn" onClick={() => setCatalogOpen(true)}>
              <Library size={16} aria-hidden />
              Catégories
              <span className="pill soft">{categories.length}</span>
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => load()}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : null}
              Actualiser
            </button>
          </>
        }
      />

      <Alert tone="error" onDismiss={() => setError("")}>
        {error}
      </Alert>
      <Alert tone="ok" onDismiss={() => setMessage("")}>
        {message}
      </Alert>

      <div className="guide-layout guide-fullscreen">
        {catalogOpen ? <div className="guide-sheet-backdrop" onClick={() => setCatalogOpen(false)} /> : null}
        <section className={`guide-catalog ${catalogOpen ? "is-open" : ""}`}>
          <div className="guide-section-title">
            <div>
              <p className="eyebrow">Bibliothèque du guide</p>
              <h2 style={{ margin: 0 }}>Catégories et articles</h2>
              <p className="guide-cat-meta">{categories.length} catégories · {articleCount} articles</p>
            </div>
            <button type="button" className="icon-btn" onClick={() => setCatalogOpen(false)} aria-label="Fermer les catégories">
              <X size={19} aria-hidden />
            </button>
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
                        onClick={() => setConfirmAction({ type: "category", id: cat.id })}
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
                            onClick={() => setConfirmAction({ type: "article", id: a.id })}
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
                <ConfirmDialog
                  open={Boolean(confirmAction)}
                  title={confirmAction?.type === "category" ? "Supprimer la catégorie ?" : "Supprimer l’article ?"}
                  message={confirmAction?.type === "category" ? "Tous les articles de cette catégorie seront également supprimés." : "Cet article ne sera plus disponible dans le guide."}
                  confirmLabel="Supprimer"
                  danger
                  busy={confirmAction ? rowBusy === `del-${confirmAction.type === "category" ? "c" : "a"}-${confirmAction.id}` : false}
                  onCancel={() => setConfirmAction(null)}
                  onConfirm={() => confirmAction && (confirmAction.type === "category" ? removeCategory(confirmAction.id) : removeArticle(confirmAction.id))}
                />
              </div>
            ))
          )}
        </section>

        <aside className="guide-editor">
          <div className="panel">
            <div className="tabs" role="tablist">
              <button
                type="button"
                className={editorTab === "article" && !preview ? "tab active" : "tab"}
                aria-selected={editorTab === "article" && !preview}
                onClick={() => {
                  setEditorTab("article");
                  setPreview(false);
                }}
              >
                <FilePlus2 size={17} aria-hidden />
                <span><strong>Rédiger</strong><small>Écrire un article</small></span>
              </button>
              <button
                type="button"
                className={preview ? "tab active" : "tab"}
                aria-selected={preview}
                onClick={() => {
                  setEditorTab("article");
                  setPreview(true);
                }}
              >
                <span><strong>Aperçu</strong><small>Voir le rendu final</small></span>
              </button>
              <button
                type="button"
                className={editorTab === "category" ? "tab active" : "tab"}
                aria-selected={editorTab === "category"}
                onClick={() => {
                  setEditorTab("category");
                  setPreview(false);
                }}
              >
                <FolderPlus size={17} aria-hidden />
                <span><strong>Organiser</strong><small>Créer une catégorie</small></span>
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
              preview ? (
                <div className="guide-preview">
                  <div className="preview-toolbar">
                    <span>Aperçu du guide</span>
                    <button type="button" className="btn small ghost" onClick={() => setPreview(false)}>
                      Revenir à l’édition
                    </button>
                  </div>
                  <h1>{articleForm.title || "Titre de l’article"}</h1>
                  <MarkdownPreview content={articleForm.content} />
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
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MarkdownPreview({ content }) {
  const lines = String(content || "").split(/\r?\n/);
  const blocks = [];
  let list = [];
  function flushList() {
    if (list.length) {
      blocks.push(<ul key={`list-${blocks.length}`}>{list}</ul>);
      list = [];
    }
  }
  lines.forEach((line, index) => {
    if (line.trim().startsWith("- ")) {
      list.push(<li key={`item-${index}`}>{line.trim().slice(2)}</li>);
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (line.startsWith("### ")) blocks.push(<h4 key={index}>{line.slice(4)}</h4>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={index}>{line.slice(3)}</h3>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={index}>{line.slice(2)}</h2>);
    else blocks.push(<p key={index}>{line}</p>);
  });
  flushList();
  return <div className="guide-preview-content">{blocks.length ? blocks : <p className="muted">Commencez à rédiger pour voir l’aperçu.</p>}</div>;
}
