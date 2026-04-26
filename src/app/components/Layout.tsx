import { NavLink, Outlet } from "react-router-dom";

type NavIconName = "dashboard" | "offers" | "cards" | "runs" | "settings";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/offers", label: "Anuncios", icon: "offers" },
  { to: "/cards", label: "Cards", icon: "cards" },
  { to: "/runs", label: "Execucoes", icon: "runs" },
  { to: "/settings", label: "Ajustes", icon: "settings" }
] satisfies Array<{ to: string; label: string; icon: NavIconName }>;

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "dashboard") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z" />
        <path d="M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4Z" />
        <path d="M4 14.5A1.5 1.5 0 0 1 5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z" />
        <path d="M13 14.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z" />
      </svg>
    );
  }

  if (name === "offers") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 5.5v6.9c0 .5.2 1 .6 1.4l5.1 5.1a2 2 0 0 0 2.8 0l5.9-5.9a2 2 0 0 0 0-2.8L13.8 5.1a2 2 0 0 0-1.4-.6H5.5a1 1 0 0 0-1 1Z" />
        <path d="M8 8h.01" />
      </svg>
    );
  }

  if (name === "cards") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.5h8.5A2.5 2.5 0 0 1 18 7v11.5a1 1 0 0 1-1.45.9L12 17.1l-4.55 2.3A1 1 0 0 1 6 18.5V5.5a1 1 0 0 1 1-1Z" />
        <path d="M10 8h4" />
        <path d="M10 11h4" />
      </svg>
    );
  }

  if (name === "runs") {
    return (
      <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12a7 7 0 1 0 2.05-4.95" />
        <path d="M5 5v5h5" />
        <path d="M12 8v4l2.5 2.5" />
      </svg>
    );
  }

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.4 7.4 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5Z" />
    </svg>
  );
}

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/rayquaza-logo.png" alt="Rayquaza Monitor" />
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              <NavIcon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">Fontes monitoradas</p>
          <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Liga Pokemon</span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>CardTrader</span>
          </div>
        </div>
      </aside>

      <div className="content-shell">
        <Outlet />
      </div>
    </div>
  );
}
