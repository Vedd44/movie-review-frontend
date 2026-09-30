import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Home from "./Home";
import AuthModal from "./components/AuthModal";
import ProfileMenu from "./components/ProfileMenu";
import GlobalMovieSearch from "./components/GlobalMovieSearch";
import AskReelbotLayer from "./components/AskReelbotLayer";
import FeedbackModal from "./components/FeedbackModal";
import { AskReelbotProvider } from "./context/AskReelbotContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { getFeedPath } from "./discovery";
import "./App.css";

const COOKIE_NOTICE_KEY = "reelbotCookieNoticeAccepted";
const CLOSE_TRANSIENT_UI_EVENT = "reelbot:close-transient-ui";

const BrowseLibrary = lazy(() => import("./BrowseLibrary"));
const MyMovies = lazy(() => import("./MyMovies"));
const AccountSettings = lazy(() => import("./AccountSettings"));
const ResetPassword = lazy(() => import("./ResetPassword"));
const SearchResults = lazy(() => import("./SearchResults"));
const HowReelbotWorks = lazy(() => import("./HowReelbotWorks"));
const MovieDetails = lazy(() => import("./MovieDetails"));
const PersonDetails = lazy(() => import("./PersonDetails"));
const CollectionPage = lazy(() => import("./CollectionPage"));
const CollectionsIndex = lazy(() => import("./CollectionPage").then((module) => ({ default: module.CollectionsIndex })));

function RouteLoading() {
  return (
    <div className="loading-message" role="status">
      <span className="status-glyph" aria-hidden="true"></span>
      <span>Loading ReelBot...</span>
    </div>
  );
}

function LegacyFeedRedirect() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const view = searchParams.get("view") || "latest";
  return <Navigate to={getFeedPath(view)} replace />;
}

function SiteHeader() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, openAuthPrompt } = useAuth();
  const isAskReelbotActive = location.pathname === "/" && location.hash === "#pick-for-me";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleCloseTransientUi = () => setMobileMenuOpen(false);
    window.addEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);
    return () => window.removeEventListener(CLOSE_TRANSIENT_UI_EVENT, handleCloseTransientUi);
  }, []);

  const navItems = [
    { label: "Ask ReelBot", to: "/#pick-for-me", isActive: isAskReelbotActive },
    { label: "Browse", to: "/browse", isActive: location.pathname === "/browse" },
    { label: "Collections", to: "/collections", isActive: location.pathname.startsWith("/collections") },
    { label: "My Movies", to: "/my-movies", isActive: location.pathname === "/my-movies" },
  ];

  const renderNavLinks = () =>
    navItems.map((item) => (
      <NavLink key={item.label} to={item.to} className={`site-nav-link${item.isActive ? " is-active" : ""}`}>
        {item.label}
      </NavLink>
    ));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-header-left">
          <NavLink to="/" className="site-brand">
            <img className="reelbot-brand-logo" src="/brand/reelbot-logo.svg" alt="ReelBot" width="134" height="52" />
          </NavLink>
        </div>

        <div className="site-header-center" aria-label="Primary">
          <nav id="site-primary-nav" className="site-nav site-nav--desktop" aria-label="Primary">
            {renderNavLinks()}
          </nav>
        </div>

        <div className="site-header-right">
          <GlobalMovieSearch />
          {!user ? (
            <button
              type="button"
              className="reelbot-inline-button site-auth-trigger"
              onClick={() => openAuthPrompt("nav")}
            >
              Sign in
            </button>
          ) : null}
          {user ? <ProfileMenu /> : null}
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
            {!user ? (
              <button
                type="button"
                className="site-nav-link site-nav-account-link"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthPrompt("nav");
                }}
              >
                Sign in
              </button>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}


function MobileBottomNav() {
  const location = useLocation();
  const items = [
    { label: "Pick for me", to: "/#pick-for-me", active: location.pathname === "/" },
    { label: "Browse", to: "/browse", active: location.pathname === "/browse" },
    { label: "Collections", to: "/collections", active: location.pathname.startsWith("/collections") },
    { label: "My Movies", to: "/my-movies", active: location.pathname === "/my-movies" },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => (
        <NavLink key={item.label} to={item.to} className={"mobile-bottom-nav-item" + (item.active ? " is-active" : "")}>
          <span className="mobile-bottom-nav-icon" aria-hidden="true"></span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function SiteFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return <>
    <footer className="site-footer"><div className="site-footer-inner">
      <div className="site-footer-brand">
        <NavLink to="/" aria-label="ReelBot home"><img className="reelbot-footer-logo" src="/brand/reelbot-logo.svg" alt="ReelBot" width="154" height="60" loading="lazy" /></NavLink>
        <p className="site-footer-copy">Stop browsing. Start watching.</p>
      </div>
      <nav className="site-footer-nav" aria-label="Footer"><div className="site-footer-links">
        <NavLink to="/#pick-for-me" className="site-footer-link">Ask ReelBot</NavLink>
        <NavLink to="/browse" className="site-footer-link">Browse</NavLink>
        <NavLink to="/collections" className="site-footer-link">Collections</NavLink>
        <NavLink to="/my-movies" className="site-footer-link">My Movies</NavLink>
        <NavLink to="/how-reelbot-works" className="site-footer-link site-footer-link--secondary">How it works</NavLink>
        <button type="button" className="site-footer-link site-footer-link--secondary site-footer-feedback" onClick={() => setFeedbackOpen(true)} aria-label="Send feedback"><span className="site-footer-feedback-icon" aria-hidden="true">◌</span>Feedback</button>
      </div></nav>
      <div className="site-footer-bottom-bar"><p className="site-footer-credit">© 2026 ReelBot · Movie data by <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></p></div>
    </div></footer>
    <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
  </>;
}

function CookieNotice() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem(COOKIE_NOTICE_KEY) === "true";
  });

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    }

    setDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="cookie-notice" role="status" aria-live="polite">
      <p className="cookie-notice-copy">ReelBot uses cookies to improve performance and understand usage.</p>
      <button type="button" className="reelbot-inline-button cookie-notice-button" onClick={handleDismiss}>
        OK
      </button>
    </div>
  );
}

function AppShell() {
  return (
    <AskReelbotProvider>
      <div className="app-shell">
        <SiteHeader />
        <main className="site-main">
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/now-playing" element={<Home routeView="latest" isFeedRoute />} />
              <Route path="/trending" element={<Home routeView="popular" isFeedRoute />} />
              <Route path="/coming-soon" element={<Home routeView="upcoming" isFeedRoute />} />
              <Route path="/browse" element={<BrowseLibrary />} />
              <Route path="/collections" element={<CollectionsIndex />} />
              <Route path="/collections/:collectionSlug" element={<CollectionPage />} />
              <Route path="/my-movies" element={<MyMovies />} />
              <Route path="/account" element={<AccountSettings />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/how-reelbot-works" element={<HowReelbotWorks />} />
              <Route path="/movie/:legacyMovieId" element={<MovieDetails />} />
              <Route path="/movies/:legacyMovieId/:legacySlug" element={<MovieDetails />} />
              <Route path="/movies/:movieSlug" element={<MovieDetails />} />
              <Route path="/person/:personId" element={<PersonDetails />} />
              <Route path="/people/:personSlug" element={<PersonDetails />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <SiteFooter />
      <MobileBottomNav />
        <CookieNotice />
        <AuthModal />
        <AskReelbotLayer />
      </div>
    </AskReelbotProvider>
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
      <AuthProvider>
        <QueryRedirectGuard />
      </AuthProvider>
    </Router>
  );
}

export default App;
