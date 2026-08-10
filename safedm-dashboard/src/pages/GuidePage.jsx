import { useCallback, useEffect, useState } from "react";
import {
  createArticle,
  createCategory,
  deleteArticle,
  getGuideCategories,
  updateArticle,
} from "../services/adminApi";

export default function GuidePage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [catForm, setCatForm] = useState({ title: "", description: "" });
  const [articleForm, setArticleForm] = useState({
    category_id: "",
    title: "",
    content: "",
    is_published: true,
  });

  const load = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreateCategory(e) {
    e.preventDefault();
    setMessage("");
    try {
      await createCategory({
        title: catForm.title,
        description: catForm.description || null,
        display_order: 0,
      });
      setCatForm({ title: "", description: "" });
      setMessage("Catégorie créée.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onCreateArticle(e) {
    e.preventDefault();
    setMessage("");
    try {
      await createArticle({
        category_id: Number(articleForm.category_id),
        title: articleForm.title,
        content: articleForm.content,
        is_published: articleForm.is_published,
        display_order: 0,
      });
      setArticleForm((f) => ({ ...f, title: "", content: "" }));
      setMessage("Article créé.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePublish(article) {
    try {
      await updateArticle(article.id, { is_published: !article.is_published });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeArticle(id) {
    if (!window.confirm("Supprimer cet article ?")) return;
    try {
      await deleteArticle(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Guide CMS</h1>
      <p className="muted">Catégories et articles pédagogiques</p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      <div className="grid-2">
        <form className="panel" onSubmit={onCreateCategory}>
          <h2>Nouvelle catégorie</h2>
          <label>
            Titre
            <input
              value={catForm.title}
              onChange={(e) => setCatForm({ ...catForm, title: e.target.value })}
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
            />
          </label>
          <button className="btn primary" type="submit">
            Créer
          </button>
        </form>

        <form className="panel" onSubmit={onCreateArticle}>
          <h2>Nouvel article</h2>
          <label>
            Catégorie
            <select
              value={articleForm.category_id}
              onChange={(e) =>
                setArticleForm({ ...articleForm, category_id: e.target.value })
              }
              required
            >
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
              required
            />
          </label>
          <label>
            Contenu
            <textarea
              rows={5}
              value={articleForm.content}
              onChange={(e) =>
                setArticleForm({ ...articleForm, content: e.target.value })
              }
              required
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
            />
            Publié
          </label>
          <button className="btn primary" type="submit">
            Créer
          </button>
        </form>
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="panel">
          <h2>{cat.title}</h2>
          {cat.description ? <p className="muted">{cat.description}</p> : null}
          <ul className="article-list">
            {(cat.articles || []).map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <span className="muted">
                    {" "}
                    · {a.is_published ? "Publié" : "Brouillon"}
                  </span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => togglePublish(a)}
                  >
                    {a.is_published ? "Dépublier" : "Publier"}
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => removeArticle(a.id)}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
