import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
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
  Terminal,
  Users,
} from "lucide-react";
import SafeDMLogo from "./SafeDMLogo";
import { useAuth } from "../context/useAuth";
import { useEffect, useState } from "react";
import { HelpSheet } from "./ui";
import CommandPalette from "./CommandPalette";

const NAV_GROUPS = [
  {
    title: "Supervision",
    links: [
      { to: "/", label: "Statistiques", end: true, icon: LayoutDashboard },
      { to: "/threats", label: "Menaces", icon: ShieldAlert },
      { to: "/reports", label: "Signalements", icon: Flag },
      { to: "/link-gate", label: "Porte de liens", icon: Link2 },
    ],
  },
  {
    title: "Catalogue",
    links: [
      { to: "/applications", label: "Applications", icon: Smartphone },
      { to: "/users", label: "Utilisateurs", icon: Users },
    ],
  },
  {
    title: "Modèle",
    links: [
      { to: "/training", label: "Entraînement", icon: BrainCircuit },
      { to: "/operations", label: "Opérations", icon: Settings2 },
    ],
  },
  {
    title: "Contenu",
    links: [
      { to: "/guide", label: "Guide", icon: BookOpen },
      { to: "/policies", label: "Politiques", icon: FileText },
    ],
  },
];

const SIDEBAR_KEY = "safedm.sidebar";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const help = getHelpContent(location.pathname);

  useEffect(() => {
    document.documentElement.classList.toggle("sidebar-rail", collapsed);
    return () => document.documentElement.classList.remove("sidebar-rail");
  }, [collapsed]);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navigation principale">
        <div className="brand">
          <SafeDMLogo size={collapsed ? 28 : 34} variant={collapsed ? "icon" : "full"} />
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="sidebar-group" key={group.title}>
              {!collapsed ? <p className="sidebar-group-label">{group.title}</p> : null}
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    title={collapsed ? link.label : undefined}
                    aria-label={collapsed ? link.label : undefined}
                    className={({ isActive }) =>
                      isActive ? "nav-link active" : "nav-link"
                    }
                  >
                    <Icon size={18} strokeWidth={2.2} aria-hidden />
                    {!collapsed ? <span>{link.label}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="user-chip">
              <span className="user-avatar">
                {(user?.username || "?").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="user-name">{user?.username}</p>
                <p className="user-role">Administrateur</p>
              </div>
            </div>
          ) : (
            <div className="user-chip user-chip-rail" title={user?.username}>
              <span className="user-avatar">
                {(user?.username || "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          <button type="button" className="command-trigger" onClick={() => setCommandsOpen(true)} aria-label="Ouvrir les commandes SafeDM (Ctrl K)">
            <Terminal size={15} aria-hidden />
            {!collapsed ? <span>Commandes</span> : null}
            {!collapsed ? <kbd>Ctrl K</kbd> : null}
          </button>
          <button type="button" className="btn ghost logout-btn" onClick={logout} title={collapsed ? "Déconnexion" : undefined} aria-label={collapsed ? "Déconnexion" : undefined}>
            <LogOut size={16} aria-hidden />
            {!collapsed ? "Déconnexion" : null}
          </button>
          <button type="button" className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Déplier le menu" : "Replier le menu"} title={collapsed ? "Déplier le menu" : "Replier le menu"}>
            {collapsed ? <ChevronsRight size={16} aria-hidden /> : <ChevronsLeft size={16} aria-hidden />}
            {!collapsed ? "Replier" : null}
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
      <CommandPalette open={commandsOpen} onOpen={() => setCommandsOpen(true)} onClose={() => setCommandsOpen(false)} />
    </div>
  );
}

function getHelpContent(pathname) {
  if (pathname === "/operations") {
    return {
      title: "Comprendre les opérations",
      sections: [
        { title: "Patches & canary", body: "Un patch est une version de modèle. Le pourcentage canary indique la part du trafic qui le teste. Approuver valide son déploiement ; Rétablir revient à la version précédente. Pas besoin de Play Store staged rollout pour l’instant." },
        { title: "Agrégation", body: "Agrège les signalements et menaces anonymes des 7 derniers jours vers un manifeste policy (seuils + statistiques). Cette action ne réentraîne pas les poids du modèle." },
        { title: "Seuils", body: "Une politique = seuils d’analyse cloud (0–100) pour une entreprise (tenant_key) et une région. Quand le client envoie ce tenant_key à /analysis, ces seuils remplacent les seuils globaux. Ordre : sûr < suspect < critique. La confiance (0–1) empêche d’affirmer SAFE trop vite." },
        { title: "Rétention & audit", body: "La rétention indique les signatures candidates au nettoyage. Le journal d’audit garde la trace des actions sensibles ; il est paginé pour rester lisible." },
      ],
    };
  }
  if (pathname === "/training") {
    return {
      title: "Du jeu de données au téléphone",
      sections: [
        { title: "1. Préparer le jeu", body: "Un jeu est une liste de messages étiquetés : message et expected (bénin ou malveillant). L’onglet Ajouter importe CSV/JSON. Depuis Signalements, utilisez Lire et annoter, lisez le texte complet, choisissez son label et enregistrez-le dans la file en base. Créez ensuite un jeu depuis cette file. Un signalement par empreinte seule n’a pas de texte et ne peut pas être entraîné. FastText reste un outil de parité/tests, pas le pipeline canary." },
        { title: "Supprimer les données d’entraînement", body: "Dans Jeux, Supprimer enlève le jeu, les entraînements liés et leurs fichiers locaux. Dans Résultats, Supprimer enlève seulement cet entraînement et ses fichiers. Cette suppression ne retire pas un patch déjà publié en canary." },
        { title: "2. Lancer l’entraînement", body: "Calcule un patch JSON à poids entiers (même format que le téléphone en OTA) et des métriques. Un entraînement « publiable » exige rappel ≥ 60 % et faux positifs ≤ 10 % au seuil opérationnel." },
        { title: "Métriques clés", body: "Rappel = menaces correctement détectées. Faux positifs = messages sains alertés à tort. Précision = part des alertes vraiment dangereuses. Faux négatifs = menaces manquées. La matrice TN/FP/FN/TP compte ces cas. CV folds = plis de validation croisée (pas le score d’entraînement)." },
        { title: "Caractéristiques (features)", body: "Chaque message devient ~50 signaux entiers (URL suspecte, urgence, OTP, etc.). Le modèle pondère ces features. L’onglet Tester montre celles qui poussent le plus le score." },
        { title: "Tester en local", body: "Onglet Tester : coller un SMS et évaluer contre un entraînement ou le manifeste canary. C’est la décision entière du patch JSON, pas le TFLite float bundlé dans l’APK." },
        { title: "Pousser puis activer", body: "« Pousser vers le canary » met le modèle à 0 % (en attente). Dans Opérations, Approuver avec un % pour l’envoyer aux téléphones. Rétablir le retire." },
      ],
    };
  }
  if (pathname === "/reports") {
    return {
      title: "Relire les signalements",
      sections: [
        { title: "Ouvrir le contenu", body: "Dans Actions, choisissez Lire et annoter pour afficher le texte complet quand il a été stocké. Les signalements par empreinte affichent leur statut mais aucun texte récupérable." },
        { title: "Enregistrer un label", body: "Après lecture, choisissez Bénin ou Malveillant, puis Enregistrer le label en base. La file est conservée côté serveur. Le fait qu’un message ait été signalé ne décide pas de son label." },
        { title: "Créer le jeu", body: "La file en haut de page liste les messages relus. Donnez un nom puis Créer un jeu. Il apparaîtra dans Entraînement → Jeux. Les messages identiques sont regroupés ; des labels contradictoires doivent être corrigés." },
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
      { title: "Link Gate et applications", body: "La Porte de liens journalise les décisions de liens. Applications gère le catalogue des applications prises en charge." },
      { title: "Utilisateurs", body: "La page Utilisateurs affiche les comptes et leur statut d’administration." },
    ],
  };
}
