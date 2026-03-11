import { useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import SearchResults from "./SearchResults";
import BrowseLibrary from "./BrowseLibrary";
import MyMovies from "./MyMovies";
import "./App.css";

const SITE_VERSION = "v0.2";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const navItems = [
    { label: "Now Playing", to: "/?view=latest#movie-grid", isActive: location.pathname === "/" && (currentView === "latest" || currentView === "now_playing") },
    { label: "Popular", to: "/?view=popular#movie-grid", isActive: location.pathname === "/" && currentView === "popular" },
    { label: "Coming Soon", to: "/?view=upcoming#movie-grid", isActive: location.pathname === "/" && currentView === "upcoming" },
    { label: "Browse", to: "/browse?view=popular", isActive: location.pathname === "/browse" },
    { label: "My Movies", to: "/my-movies", isActive: location.pathname === "/my-movies" },
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
          <button
            type="button"
            className={`site-menu-toggle${mobileMenuOpen ? " is-open" : ""}`}
            aria-expanded={mobileMenuOpen}
            aria-controls="site-primary-nav"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`site-nav-shell${mobileMenuOpen ? " is-open" : ""}`}>
            <nav id="site-primary-nav" className="site-nav" aria-label="Primary">
              {navItems.map((item) => (
                <NavLink key={item.label} to={item.to} className={`site-nav-link${item.isActive ? " is-active" : ""}`}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <HeaderSearch />
          </div>
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
          <p className="site-footer-copy">Built with TMDB &amp; OpenAI for faster picks, clearer reads, and better next-watch decisions.</p>
        </div>

        <div className="site-footer-meta">
          <p className="site-footer-credit">
            A passion project by <a href="https://jonnyegan.com" target="_blank" rel="noreferrer">Jonny Egan</a>, built with <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> &amp; <a href="https://openai.com/" target="_blank" rel="noreferrer">OpenAI</a>.
          </p>
          <div className="site-footer-links" aria-label="Footer">
            <NavLink to="/?view=latest#movie-grid">Now Playing</NavLink>
            <NavLink to="/?view=upcoming#movie-grid">Coming Soon</NavLink>
            <NavLink to="/browse?view=popular#library-results">Browse Library</NavLink>
            <NavLink to="/my-movies">My Movies</NavLink>
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
          <Route path="/my-movies" element={<MyMovies />} />
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
