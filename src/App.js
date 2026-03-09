import { useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import SearchResults from "./SearchResults";
import "./App.css";

function HeaderSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentQuery = new URLSearchParams(location.search).get("q") || "";
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => {
    if (location.pathname === "/search") {
      setQuery(currentQuery);
      return;
    }

    setQuery("");
  }, [location.pathname, currentQuery]);

  if (location.pathname === "/") {
    return null;
  }

  return (
    <form
      className="site-header-search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!query.trim()) {
          return;
        }

        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }}
    >
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search movies..."
        aria-label="Search movies"
      />
      <button type="submit">Search</button>
    </form>
  );
}

function SiteHeader({ hasHeaderSearch }) {
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get("view") || "latest";

  const navItems = [
    { label: "Latest", to: "/?view=latest", isActive: location.pathname === "/" && currentView === "latest" },
    { label: "Popular", to: "/?view=popular", isActive: location.pathname === "/" && currentView === "popular" },
    { label: "Coming Soon", to: "/?view=upcoming", isActive: location.pathname === "/" && currentView === "upcoming" },
  ];

  return (
    <header className={`site-header${hasHeaderSearch ? " has-search" : ""}`}>
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

        <div className="site-header-actions">
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

          <HeaderSearch />
        </div>
      </div>
    </header>
  );
}

function AppShell() {
  const location = useLocation();
  const hasHeaderSearch = location.pathname !== "/";

  return (
    <div className="app-shell">
      <SiteHeader hasHeaderSearch={hasHeaderSearch} />
      <main className={`site-main${hasHeaderSearch ? " has-header-search" : ""}`}>
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
