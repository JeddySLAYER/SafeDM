import { useEffect, useState } from "react";
import { getStats } from "../services/adminApi";

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Chargement…</p>;

  const cards = [
    { label: "Utilisateurs", value: stats.users_count },
    { label: "Signalements actifs", value: stats.reports_active_count },
    { label: "Menaces actives", value: stats.threats_active_count },
    { label: "Menaces rejetées", value: stats.threats_dismissed_count },
    { label: "Articles publiés", value: stats.guide_articles_published },
    { label: "Apps supportées", value: stats.supported_applications },
  ];

  return (
    <div>
      <h1>Tableau de bord</h1>
      <p className="muted">Vue d’ensemble SafeDM</p>
      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="stat-value">{c.value}</p>
            <p className="stat-label">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Providers</h2>
        <ul className="plain-list">
          <li>Gemini : {stats.gemini_configured ? "configuré" : "non configuré"}</li>
          <li>
            VirusTotal :{" "}
            {stats.virustotal_configured ? "configuré" : "non configuré"}
          </li>
          <li>Mode démo analyse : {stats.analysis_demo_mode ? "oui" : "non"}</li>
        </ul>
      </div>
    </div>
  );
}
