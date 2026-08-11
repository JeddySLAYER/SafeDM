import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  Flag,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Users,
} from "lucide-react";
import SafeDMLogo from "./SafeDMLogo";
import { useAuth } from "../context/AuthContext";

const LINKS = [
  { to: "/", label: "Vue d’ensemble", end: true, icon: LayoutDashboard },
  { to: "/threats", label: "Menaces", icon: ShieldAlert },
  { to: "/reports", label: "Signalements", icon: Flag },
  { to: "/users", label: "Utilisateurs", icon: Users },
  { to: "/guide", label: "Guide", icon: BookOpen },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

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
    </div>
  );
}
