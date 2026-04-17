import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "◈" },
  { to: "/new-offers", label: "Novos Anúncios", icon: "✦" },
  { to: "/cards", label: "Cards", icon: "🃏" },
  { to: "/runs", label: "Execuções", icon: "⚙" }
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <h1 style={{ fontFamily: "inherit" }}>Rayquaza Monitor</h1>
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>card-comparator</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-section">
          <p className="sidebar-label">Fontes monitoradas</p>
          <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>🇧🇷 Liga Pokémon</span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>🌐 CardTrader</span>
          </div>
        </div>
      </aside>

      <div className="content-shell">
        <Outlet />
      </div>
    </div>
  );
}
