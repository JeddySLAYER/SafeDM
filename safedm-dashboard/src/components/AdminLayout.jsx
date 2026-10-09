import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Flag,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Settings2,
  ShieldAlert,
  Smartphone,
  BrainCircuit,
  Users,
} from "lucide-react";
import SafeDMLogo from "./SafeDMLogo";
import { useAuth } from "../context/useAuth";
import { useState } from "react";
import { HelpSheet } from "./ui";

const LINKS = [
  { to: "/", label: "Stats", end: true, icon: LayoutDashboard },
  { to: "/threats", label: "Menaces", icon: ShieldAlert },
  { to: "/reports", label: "Signalements", icon: Flag },
  { to: "/link-gate", label: "Link Gate", icon: Link2 },
  { to: "/applications", label: "Apps", icon: Smartphone },
  { to: "/users", label: "Utilisateurs", icon: Users },
  { to: "/guide", label: "Guide", icon: BookOpen },
  { to: "/policies", label: "Politiques", icon: FileText },
  { to: "/operations", label: "Opérations", icon: Settings2 },
  { to: "/training", label: "Entraînement", icon: BrainCircuit },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const help = getHelpContent(location.pathname);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <SafeDMLogo size={34} variant="full" />
        </div>
        <p className="sidebar-caption">Administration</p>
        <nav className="sidebar-nav">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <Icon size={18} strokeWidth={2.2} aria-hidden />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="user-avatar">
              {(user?.username || "?").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="user-name">{user?.username}</p>
              <p className="user-role">Administrateur</p>
            </div>
          </div>
          <button type="button" className="btn ghost logout-btn" onClick={logout}>
            <LogOut size={16} aria-hidden />
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-content">
          <Outlet />
        </div>
      </main>
      <button
        type="button"
        className="help-fab"
        onClick={() => setHelpOpen(true)}
        aria-label={`Ouvrir l’aide : ${help.title}`}
      >
        <HelpCircle size={18} aria-hidden />
        <span>Aide</span>
      </button>
      <HelpSheet
        open={helpOpen}
        title={help.title}
        sections={help.sections}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}

function getHelpContent(pathname) {
  if (pathname === "/operations") {
    return {
      title: "Comprendre les opérations",
      sections: [
        { title: "Patches & canary", body: "Un patch est une version de modèle. Le pourcentage Canary indique la part du trafic qui le teste. Approuver valide son déploiement ; Rollback revient à la version précédente. Pas besoin de Play Store staged rollout pour l’instant." },
        { title: "Agrégation", body: "L’agrégation prépare des métriques anonymisées pour le prochain cycle de modèle. Demander une agrégation crée une demande ; cela ne lance pas encore le job Cloud Run automatiquement." },
        { title: "Seuils", body: "Les scores vont de 0 à 100 et doivent rester dans l’ordre sûr < suspect < critique. La confiance d’escalade est une valeur entre 0 et 1." },
        { title: "Rétention & audit", body: "La rétention indique les signatures candidates au nettoyage. Le journal d’audit garde la trace des actions sensibles des administrateurs." },
      ],
    };
  }
  if (pathname === "/training") {
    return {
      title: "Du jeu de données au téléphone",
      sections: [
        { title: "1. Préparer le jeu", body: "Un dataset est une liste de messages déjà étiquetés : message et expected (bénin ou malveillant). « Envoyer le dataset » les enregistre. « Jeu intégré » importe les exemples livrés avec le projet. L’aperçu montre les premiers messages, il ne lance rien." },
        { title: "2. Lancer l’entraînement", body: "« Lancer l’entraînement » calcule un modèle sur le jeu choisi et écrit les métriques (faux positifs, rappel). Un run « publiable » a passé les seuils. Un gros volume se lance plutôt avec le workflow GitHub train-model." },
        { title: "3. Pousser vers le canary", body: "« Pousser vers le canary » copie le modèle réussi dans le manifeste du serveur. Les téléphones ne changent pas encore tous. La case « promouvoir si publiable » fait cette copie dès la fin du train, seulement si les métriques sont acceptables." },
        { title: "4. Activer dans Opérations", body: "Dans Déploiement du modèle, choisis le pourcentage puis Approuver. Sous 100 %, le téléphone ne télécharge le modèle que s’il tombe dans cette part. À 100 %, tout le monde le reçoit. Rollback retire le modèle. Le fichier doit avoir une URL https et une signature, sinon le téléphone le refuse." },
      ],
    };
  }
  if (pathname === "/applications") {
    return {
      title: "Catalogue des applications",
      sections: [
        { title: "À quoi sert la liste", body: "Chaque ligne est une application Android que le téléphone peut surveiller. Le nom est celui affiché. Le package est l’identifiant Android, par exemple com.whatsapp." },
        { title: "Activée ou non", body: "Une application désactivée reste dans le catalogue, mais n’est plus proposée à la surveillance. La supprimer l’enlève du catalogue." },
        { title: "Ajouter", body: "Le bouton Ajouter ouvre une fiche. Rien n’est créé tant que vous n’enregistrez pas." },
      ],
    };
  }
  if (pathname === "/policies") {
    return {
      title: "Politiques affichées dans l'app",
      sections: [
        { title: "Deux textes", body: "La confidentialité et les conditions sont lues dans l'application au login, puis à nouveau quand quelqu'un accepte une analyse en ligne." },
        { title: "Nouvelle version", body: "Enregistrer un texte modifié augmente la version. Les téléphones redemandent l'accord." },
      ],
    };
  }
  if (pathname === "/guide") {
    return {
      title: "Rédiger un guide",
      sections: [
        { title: "Catégories", body: "Une catégorie regroupe plusieurs articles dans le guide mobile, par exemple Phishing ou SMS." },
        { title: "Brouillon et publication", body: "Décochez Publier immédiatement pour travailler en brouillon. Un brouillon reste invisible dans le guide public jusqu’à sa publication." },
        { title: "Aperçu", body: "L’onglet Aperçu montre la mise en forme du contenu avant l’enregistrement. Les titres Markdown et les listes sont rendus comme dans le guide." },
      ],
    };
  }
  if (pathname === "/") {
    return {
      title: "Lire les statistiques",
      sections: [
        { title: "Cartes", body: "Les cartes résument les utilisateurs, signalements, menaces et performances du modèle sur les données disponibles." },
        { title: "Fournisseurs", body: "Cette zone indique quels fournisseurs d’analyse sont configurés. Mode démo signifie que les réponses simulées sont utilisées." },
        { title: "Tendance", body: "Le graphique compare signalements et menaces sur les sept derniers jours." },
      ],
    };
  }
  return {
    title: "Naviguer dans SafeDM",
    sections: [
      { title: "Menaces et signalements", body: "Utilisez Menaces pour modérer les résultats détectés et Signalements pour traiter les remontées anonymisées." },
      { title: "Link Gate et applications", body: "Link Gate journalise les décisions de liens. Applications gère le catalogue des applications supportées." },
      { title: "Utilisateurs", body: "La page Utilisateurs affiche les comptes et leur statut d’administration." },
    ],
  };
}
