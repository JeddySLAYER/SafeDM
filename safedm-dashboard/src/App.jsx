import SafeDMLogo from "./components/SafeDMLogo";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <SafeDMLogo size={36} />
          <span className="brand-text">
            <span className="brand-safe">Safe</span>
            <span className="brand-dm">DM</span>
          </span>
        </div>
        <span className="badge">Admin</span>
      </header>

      <main className="app-main">
        <h1>Dashboard administrateur</h1>
        <p className="subtitle">
          Projet initialisé (Sprint 0). Les écrans stats, utilisateurs, menaces
          et guide arriveront au Sprint 8.
        </p>
        <div className="card">
          <h2>Prochaine étape</h2>
          <p>
            Connecter l&apos;API FastAPI (
            <code>VITE_API_BASE_URL</code>) une fois le backend démarré.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
