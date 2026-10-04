import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Navigate } from "react-router-dom";
import SafeDMLogo from "../components/SafeDMLogo";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="password-field">
            <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
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
