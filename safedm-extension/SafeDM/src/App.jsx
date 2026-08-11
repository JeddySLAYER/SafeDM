import { useEffect, useState } from "react";
import {
  analyzeContent,
  ApiError,
  login,
  logout,
} from "./shared/api.js";
import {
  getApiBase,
  getToken,
  getUsername,
  setApiBase,
} from "./shared/storage.js";
import { DEFAULT_API_BASE } from "./shared/config.js";

const DECISION_STYLES = {
  ALLOW: {
    bg: "bg-[var(--safedm-ok-bg)]",
    text: "text-[var(--safedm-ok)]",
    label: "Autorisé",
  },
  WARN: {
    bg: "bg-[var(--safedm-warn-bg)]",
    text: "text-[var(--safedm-warn)]",
    label: "Attention",
  },
  BLOCK: {
    bg: "bg-[var(--safedm-danger-bg)]",
    text: "text-[var(--safedm-danger)]",
    label: "Danger",
  },
};

function ResultCard({ result }) {
  if (!result) return null;
  const decision = (result.decision || "WARN").toUpperCase();
  const style = DECISION_STYLES[decision] || DECISION_STYLES.WARN;

  return (
    <section className={`rounded-lg border border-[var(--safedm-line)] p-3 ${style.bg}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${style.text}`}>
        {style.label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--safedm-ink)]">
        {result.headline || decision}
      </p>
      {result.risk_score != null && (
        <p className="mt-1 text-xs text-[var(--safedm-muted)]">
          Score risque : {result.risk_score}
          {result.severity ? ` · ${result.severity}` : ""}
        </p>
      )}
      {(result.url || result.domain) && (
        <p className="mt-1 break-all text-xs text-[var(--safedm-muted)]">
          {result.url || result.domain}
        </p>
      )}
    </section>
  );
}

function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [content, setContent] = useState("");
  const [tabInfo, setTabInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiBase, setApiBaseInput] = useState(DEFAULT_API_BASE);

  useEffect(() => {
    (async () => {
      const [token, name, base] = await Promise.all([
        getToken(),
        getUsername(),
        getApiBase(),
      ]);
      setAuthed(Boolean(token));
      setDisplayName(name || "");
      setApiBaseInput(base || DEFAULT_API_BASE);
      setReady(true);

      chrome.runtime.sendMessage({ action: "getTabInfo" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response) {
          setTabInfo(response);
          if (response.url && /^https?:\/\//i.test(response.url)) {
            setContent((prev) => prev || response.url);
          }
        }
      });
    })();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setApiBase(
        apiBase.trim() === DEFAULT_API_BASE ? "" : apiBase.trim(),
      );
      await login(username.trim(), password);
      setAuthed(true);
      setDisplayName(username.trim());
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    setAuthed(false);
    setDisplayName("");
    setResult(null);
    setError("");
  }

  async function handleAnalyze(e) {
    e?.preventDefault?.();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "analyze",
            text: content,
            showOnPage: true,
            tabId: tabInfo?.id,
          },
          (res) => resolve(res),
        );
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (!response?.ok) {
        throw new ApiError(
          response?.error || "Échec de l’analyse",
          response?.status || 0,
          null,
        );
      }
      setResult(response.result);
    } catch (err) {
      // Fallback: call API from popup if background messaging fails
      try {
        const direct = await analyzeContent(content);
        setResult(direct);
        if (tabInfo?.id) {
          chrome.runtime.sendMessage({
            action: "showResultOnPage",
            tabId: tabInfo.id,
            result: direct,
            text: content,
          });
        }
      } catch (inner) {
        setError(
          err?.message ||
            (inner instanceof ApiError ? inner.message : "Analyse impossible"),
        );
        if (err?.status === 401 || inner?.status === 401) {
          setAuthed(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function usePageUrl() {
    if (tabInfo?.url) setContent(tabInfo.url);
  }

  if (!ready) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-[var(--safedm-muted)]">
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-[420px] bg-[var(--safedm-bg)]">
      <header className="border-b border-[var(--safedm-line)] bg-[var(--safedm-surface)] px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src="simplify-logo.png"
            alt="SafeDM"
            className="h-9 w-9 rounded-md object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-[var(--safedm-ink)]">
              SafeDM
            </h1>
            <p className="text-xs text-[var(--safedm-muted)]">
              Analyse liens &amp; messages
            </p>
          </div>
          {authed && (
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-medium text-[var(--safedm-blue)] hover:underline"
            >
              Déconnexion
            </button>
          )}
        </div>
      </header>

      <main className="space-y-3 p-4">
        {!authed ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <p className="text-sm text-[var(--safedm-muted)]">
              Connectez-vous avec votre compte SafeDM.
            </p>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--safedm-muted)]">
                Identifiant
              </span>
              <input
                className="w-full rounded-md border border-[var(--safedm-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--safedm-blue)]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--safedm-muted)]">
                Mot de passe
              </span>
              <input
                type="password"
                className="w-full rounded-md border border-[var(--safedm-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--safedm-blue)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="button"
              className="text-xs text-[var(--safedm-muted)] underline"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Masquer l’API" : "API avancée"}
            </button>
            {showAdvanced && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--safedm-muted)]">
                  Base API
                </span>
                <input
                  className="w-full rounded-md border border-[var(--safedm-line)] bg-white px-3 py-2 text-xs outline-none focus:border-[var(--safedm-blue)]"
                  value={apiBase}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                />
              </label>
            )}

            {error && (
              <p className="rounded-md bg-[var(--safedm-danger-bg)] px-3 py-2 text-xs text-[var(--safedm-danger)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--safedm-blue)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--safedm-blue-hover)] disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        ) : (
          <>
            <p className="text-xs text-[var(--safedm-muted)]">
              Connecté
              {displayName ? (
                <>
                  {" "}
                  · <span className="font-medium text-[var(--safedm-ink)]">{displayName}</span>
                </>
              ) : null}
            </p>

            <form onSubmit={handleAnalyze} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--safedm-muted)]">
                  URL ou texte à vérifier
                </span>
                <textarea
                  rows={4}
                  className="w-full resize-none rounded-md border border-[var(--safedm-line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--safedm-blue)]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="https://… ou collez un message"
                  required
                />
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={usePageUrl}
                  disabled={!tabInfo?.url}
                  className="rounded-md border border-[var(--safedm-line)] bg-white px-3 py-2 text-xs font-medium text-[var(--safedm-ink)] hover:bg-[var(--safedm-blue-tint)] disabled:opacity-50"
                >
                  URL de l’onglet
                </button>
                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="flex-1 rounded-md bg-[var(--safedm-blue)] py-2 text-sm font-semibold text-white hover:bg-[var(--safedm-blue-hover)] disabled:opacity-60"
                >
                  {loading ? "Analyse…" : "Analyser"}
                </button>
              </div>
            </form>

            {error && (
              <p className="rounded-md bg-[var(--safedm-danger-bg)] px-3 py-2 text-xs text-[var(--safedm-danger)]">
                {error}
              </p>
            )}

            <ResultCard result={result} />

            <p className="text-[11px] leading-snug text-[var(--safedm-muted)]">
              Astuce : clic droit sur un lien ou une sélection → « Vérifier avec
              SafeDM ».
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
