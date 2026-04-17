import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/cards", label: "Cards" },
  { to: "/runs", label: "Execucoes" }
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">RC</span>
          <div>
            <p className="eyebrow">Rayquaza Monitor</p>
            <h1>card-comparator</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Uso responsavel</p>
          <p className="muted">
            Coleta apenas dados publicos, com delays e sem burlar login, captcha ou protecoes.
          </p>
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Monitor local</p>
            <h2>Painel de ofertas Rayquaza</h2>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

