import { BrowserRouter as Router, NavLink, Route, Routes, useLocation } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import SearchResults from "./SearchResults";
import "./App.css";

function SiteHeader() {
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get("view") || "latest";

  const navItems = [
    { label: "Latest", to: "/?view=latest", isActive: location.pathname === "/" && currentView === "latest" },
    { label: "Popular", to: "/?view=popular", isActive: location.pathname === "/" && currentView === "popular" },
    { label: "Coming Soon", to: "/?view=upcoming", isActive: location.pathname === "/" && currentView === "upcoming" },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/?view=latest" className="site-brand">
          <span className="site-brand-mark" aria-hidden="true">
            <span className="site-brand-ring"></span>
            <span className="site-brand-play"></span>
            <span className="site-brand-ai-link"></span>
            <span className="site-brand-ai-node"></span>
          </span>
          <span className="site-brand-copy">
            <span className="site-brand-title">ReelBot</span>
            <span className="site-brand-subtitle">AI movie companion</span>
          </span>
        </NavLink>

        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={`site-nav-link${item.isActive ? " is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function AppShell() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/search" element={<SearchResults />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
