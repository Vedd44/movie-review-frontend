import { useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import SearchResults from "./SearchResults";
import BrowseLibrary from "./BrowseLibrary";
import "./App.css";

const SITE_VERSION = "v0.1.0";

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
  }, [currentQuery, location.pathname]);

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
    { label: "Browse", to: "/browse?view=popular", isActive: location.pathname === "/browse" },
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
            <span className="site-brand-subtitle">The AI movie companion</span>
          </span>
        </NavLink>

        <div className="site-header-actions">
          <nav className="site-nav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink key={item.label} to={item.to} className={`site-nav-link${item.isActive ? " is-active" : ""}`}>
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

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="site-footer-title">ReelBot</div>
          <p className="site-footer-copy">The AI movie companion for faster picks, sharper reads, and better next-watch decisions.</p>
        </div>

        <div className="site-footer-meta">
          <p className="site-footer-credit">
            Passion project powered by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> &amp; <a href="https://openai.com/" target="_blank" rel="noreferrer">OpenAI</a> by <a href="https://jonnyegan.com" target="_blank" rel="noreferrer">Jonny Egan</a>.
          </p>
          <div className="site-footer-links" aria-label="Footer">
            <NavLink to="/?view=latest">Latest</NavLink>
            <NavLink to="/?view=upcoming">Coming Soon</NavLink>
            <NavLink to="/browse?view=popular">Browse Library</NavLink>
          </div>
          <div className="site-footer-version" aria-label={`Current site version ${SITE_VERSION}`}>{SITE_VERSION}</div>
        </div>
      </div>
    </footer>
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
          <Route path="/browse" element={<BrowseLibrary />} />
          <Route path="/movies/:id/:slug?" element={<MovieDetails />} />
          <Route path="/search" element={<SearchResults />} />
        </Routes>
      </main>
      <SiteFooter />
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
