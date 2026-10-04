import { useEffect, useState } from "react";
import { DEFAULT_API_BASE } from "../shared/config.js";
import {
  clearSession,
  getApiBase,
  getUsername,
  setApiBase,
} from "../shared/storage.js";

function isAllowedApi(value) {
  let parsed;
  try {
    parsed = new URL(value.trim().replace(/\/+$/, ""));
  } catch {
    return false;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  return parsed.protocol === "https:" || local;
}

export default function Options() {
  const [apiBase, setApiBaseValue] = useState(DEFAULT_API_BASE);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getApiBase(), getUsername()]).then(([base, name]) => {
      setApiBaseValue(base || DEFAULT_API_BASE);
      setUsername(name || "");
    });
  }, []);

  async function save(event) {
    event.preventDefault();
    const value = apiBase.trim().replace(/\/+$/, "");
    setMessage("");
    setError("");
    if (!isAllowedApi(value)) {
      setError("Utilisez une URL HTTPS, ou localhost/127.0.0.1 pour le développement.");
      return;
    }
    setSaving(true);
    try {
      await setApiBase(value === DEFAULT_API_BASE ? "" : value);
      setMessage("Paramètres enregistrés.");
    } catch {
      setError("Impossible d’enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  }

  async function resetApi() {
    setApiBaseValue(DEFAULT_API_BASE);
    await setApiBase("");
    setMessage("API officielle restaurée.");
    setError("");
  }

  async function disconnect() {
    await clearSession();
    setUsername("");
    setMessage("Session locale effacée.");
  }

  return (
    <main className="options-page">
      <header className="options-header">
        <div>
          <p className="options-eyebrow">SafeDM</p>
          <h1>Paramètres de l’extension</h1>
          <p className="options-muted">
            Configurez la connexion sans mélanger les réglages avec le formulaire de login.
          </p>
        </div>
      </header>

      <section className="options-card">
        <h2>Serveur d’analyse</h2>
        <p className="options-muted">
          Les analyses explicites du popup et du menu contextuel sont envoyées à cette API.
          Le texte n’est pas enregistré par SafeDM.
        </p>
        <form onSubmit={save}>
          <label className="options-label" htmlFor="api-base">Base API</label>
          <input
            id="api-base"
            className="options-input"
            value={apiBase}
            onChange={(event) => setApiBaseValue(event.target.value)}
            spellCheck="false"
            required
          />
          <p className="options-help">
            HTTPS obligatoire à distance. HTTP est accepté uniquement pour localhost et 127.0.0.1.
          </p>
          <div className="options-actions">
            <button className="options-button primary" type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button className="options-button" type="button" onClick={resetApi}>
              Restaurer l’API officielle
            </button>
          </div>
        </form>
      </section>

      <section className="options-card">
        <h2>Session</h2>
        <p className="options-muted">
          {username ? `Compte actuellement mémorisé : ${username}` : "Aucun compte mémorisé."}
        </p>
        <button className="options-button danger" type="button" onClick={disconnect}>
          Effacer la session locale
        </button>
      </section>

      {message ? <p className="options-status success" role="status">{message}</p> : null}
      {error ? <p className="options-status failure" role="alert">{error}</p> : null}
    </main>
  );
}
