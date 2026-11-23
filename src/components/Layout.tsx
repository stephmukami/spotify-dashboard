import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../lib/session";

export function Layout() {
  const { session } = useSession();
  const showNav = session?.hasConsented && session.lastSyncedAt;

  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Taste Graph
        </NavLink>
        {showNav && (
          <nav className="nav">
            <NavLink to="/graph">Graph</NavLink>
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        )}
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
