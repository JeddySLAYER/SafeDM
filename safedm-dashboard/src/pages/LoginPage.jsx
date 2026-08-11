import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import SafeDMLogo from "../components/SafeDMLogo";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    apiRequest("/health", { auth: false })
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false));
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || "Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand center">
          <SafeDMLogo size={48} variant="full" />
        </div>
        <h1>Espace admin</h1>
        <p className="muted">Connexion réservée aux comptes administrateurs.</p>
        <p className={apiOk === null ? "muted" : apiOk ? "ok" : "error"}>
          API :{" "}
          {apiOk === null
            ? "vérification…"
            : apiOk
              ? "joignable"
              : "injoignable — démarrez le backend (:8000)"}
        </p>
        <label>
          Identifiant
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button
          className="btn primary block"
          type="submit"
          disabled={loading || apiOk === false}
        >
          {loading ? <span className="btn-spinner" /> : null}
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
