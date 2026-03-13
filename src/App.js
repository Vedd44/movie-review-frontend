import { useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import SearchResults from "./SearchResults";
import BrowseLibrary from "./BrowseLibrary";
import MyMovies from "./MyMovies";
import HowReelbotWorks from "./HowReelbotWorks";
import { getFeedPath } from "./discovery";
import "./App.css";

const SITE_VERSION = "v0.3";

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
        placeholder="Search movies"
        aria-label="Search movies"
      />
      <button type="submit">Search</button>
    </form>
  );
}

function LegacyFeedRedirect() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const view = searchParams.get("view") || "latest";
  return <Navigate to={getFeedPath(view)} replace />;
}

function SiteHeader({ hasHeaderSearch }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const navItems = [
    { label: "Now Playing", to: "/now-playing", isActive: location.pathname === "/now-playing" },
    { label: "Trending", to: "/trending", isActive: location.pathname === "/trending" },
    { label: "Coming Soon", to: "/coming-soon", isActive: location.pathname === "/coming-soon" },
    { label: "Browse", to: "/browse", isActive: location.pathname === "/browse" },
    { label: "My Movies", to: "/my-movies", isActive: location.pathname === "/my-movies" },
  ];

  const renderNavLinks = () =>
    navItems.map((item) => (
      <NavLink key={item.label} to={item.to} className={`site-nav-link${item.isActive ? " is-active" : ""}`}>
        {item.label}
      </NavLink>
    ));

  return (
    <header className={`site-header${hasHeaderSearch ? " has-search" : ""}`}>
      <div className="site-header-inner">
        <div className="site-header-left">
          <NavLink to="/" className="site-brand">
            <span className="site-brand-mark" aria-hidden="true">
              <span className="site-brand-ring"></span>
              <span className="site-brand-play"></span>
              <span className="site-brand-ai-link"></span>
              <span className="site-brand-ai-node"></span>
            </span>
            <span className="site-brand-copy">
              <span className="site-brand-title">ReelBot</span>
              <span className="site-brand-subtitle">Your AI movie guide</span>
            </span>
          </NavLink>
        </div>

        <div className="site-header-center" aria-label="Primary">
          <nav id="site-primary-nav" className="site-nav site-nav--desktop" aria-label="Primary">
            {renderNavLinks()}
          </nav>
        </div>

        <div className="site-header-right">
          <HeaderSearch />
          <button
            type="button"
            className={`site-menu-toggle${mobileMenuOpen ? " is-open" : ""}`}
            aria-expanded={mobileMenuOpen}
            aria-controls="site-mobile-nav"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <div className={`site-nav-shell${mobileMenuOpen ? " is-open" : ""}`}>
          <nav id="site-mobile-nav" className="site-nav site-nav--mobile" aria-label="Mobile primary">
            {renderNavLinks()}
          </nav>
          {hasHeaderSearch ? <HeaderSearch /> : null}
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
          <p className="site-footer-copy">Powered by TMDB &amp; OpenAI for faster picks, clearer reads, and better next-watch decisions.</p>
          <p className="site-footer-microcopy">ReelBot helps you find what to watch faster.</p>
        </div>

        <div className="site-footer-meta">
          <p className="site-footer-credit">
            A passion project by <a href="https://jonnyegan.com" target="_blank" rel="noreferrer">Jonny Egan</a>, built with <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> &amp; <a href="https://openai.com/" target="_blank" rel="noreferrer">OpenAI</a>.
          </p>
          <div className="site-footer-links" aria-label="Footer">
            <NavLink to="/now-playing">Now Playing</NavLink>
            <NavLink to="/coming-soon">Coming Soon</NavLink>
            <NavLink to="/browse">Browse Library</NavLink>
            <NavLink to="/how-reelbot-works">How ReelBot Works</NavLink>
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
          <Route path="/now-playing" element={<Home routeView="latest" isFeedRoute />} />
          <Route path="/trending" element={<Home routeView="popular" isFeedRoute />} />
          <Route path="/coming-soon" element={<Home routeView="upcoming" isFeedRoute />} />
          <Route path="/browse" element={<BrowseLibrary />} />
          <Route path="/my-movies" element={<MyMovies />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/how-reelbot-works" element={<HowReelbotWorks />} />
          <Route path="/movie/:id" element={<MovieDetails />} />
          <Route path="/movies/:id/:slug" element={<MovieDetails />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

function QueryRedirectGuard() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const view = params.get("view");

  if (location.pathname === "/" && view) {
    return <LegacyFeedRedirect />;
  }

  return <AppShell />;
}

function App() {
  return (
    <Router>
      <QueryRedirectGuard />
    </Router>
  );
}

export default App;
