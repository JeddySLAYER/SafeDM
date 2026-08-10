import { NavLink, Outlet } from "react-router-dom";
import SafeDMLogo from "./SafeDMLogo";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/", label: "Stats", end: true },
  { to: "/threats", label: "Menaces" },
  { to: "/users", label: "Utilisateurs" },
  { to: "/guide", label: "Guide" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <SafeDMLogo size={32} />
          <span className="brand-text">
            <span className="brand-safe">Safe</span>
            <span className="brand-dm">DM</span>
          </span>
        </div>
        <p className="sidebar-caption">Administration</p>
        <nav className="sidebar-nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p className="user-chip">{user?.username}</p>
          <button type="button" className="btn ghost" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
