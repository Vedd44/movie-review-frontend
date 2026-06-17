import { useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./Home";
import MovieDetails from "./MovieDetails";
import PersonDetails from "./PersonDetails";
import SearchResults from "./SearchResults";
import BrowseLibrary from "./BrowseLibrary";
import MyMovies from "./MyMovies";
import HowReelbotWorks from "./HowReelbotWorks";
import AccountSettings from "./AccountSettings";
import ResetPassword from "./ResetPassword";
import AuthModal from "./components/AuthModal";
import ProfileMenu from "./components/ProfileMenu";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { getFeedPath } from "./discovery";
import { homeFeedService } from "./services/homeFeedService";
import { tasteProfileService } from "./services/tasteProfileService";
import "./App.css";

const SITE_VERSION = "v0.8";
const COOKIE_NOTICE_KEY = "reelbotCookieNoticeAccepted";
const CLOSE_TRANSIENT_UI_EVENT = "reelbot:close-transient-ui";

if (typeof window !== "undefined") {
  homeFeedService.prefetchHomeFeed("latest", 1).catch((error) => {
    console.error("Failed to prefetch homepage feed:", error);
  });
}

function LegacyFeedRedirect() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const view = searchParams.get("view") || "latest";
  return <Navigate to={getFeedPath(view)} replace />;
}

function SiteHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, openAuthPrompt } = useAuth();

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
    { label: "Now Playing", to: "/now-playing", isActive: location.pathname === "/now-playing" },
    { label: "Browse", to: "/browse", isActive: location.pathname === "/browse" },
    { label: "My Movies", to: "/my-movies", isActive: location.pathname === "/my-movies" },
  ];

  const renderNavLinks = () =>
    navItems.map((item) => (
      <NavLink key={item.label} to={item.to} className={`site-nav-link${item.isActive ? " is-active" : ""}`}>
        {item.label}
      </NavLink>
    ));

  const handleBrandClick = (event) => {
    event.preventDefault();
    const hasActivePickSession = tasteProfileService.hasActiveHomePickSession();

    if (hasActivePickSession) {
      navigate("/#your-pick", {
        state: {
          restorePickSession: true,
          scrollToPickResult: true,
        },
      });
      return;
    }

    navigate("/");
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-header-left">
          <NavLink to="/" className="site-brand" onClick={handleBrandClick}>
            <span className="site-brand-mark" aria-hidden="true">
              <span className="site-brand-ring"></span>
              <span className="site-brand-play"></span>
              <span className="site-brand-ai-link"></span>
              <span className="site-brand-ai-node"></span>
            </span>
            <span className="site-brand-copy">
              <span className="site-brand-title">ReelBot</span>
              <span className="site-brand-subtitle">Skip the scroll</span>
            </span>
          </NavLink>
        </div>

        <div className="site-header-center" aria-label="Primary">
          <nav id="site-primary-nav" className="site-nav site-nav--desktop" aria-label="Primary">
            {renderNavLinks()}
          </nav>
        </div>

        <div className="site-header-right">
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
          </nav>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  const footerLinks = [
    { label: "Now Playing", to: "/now-playing" },
    { label: "Coming Soon", to: "/coming-soon" },
    { label: "Browse", to: "/browse" },
    { label: "My Movies", to: "/my-movies" },
    { label: "How it works", to: "/how-reelbot-works", secondary: true },
  ];

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <div className="site-footer-title">ReelBot</div>
          <p className="site-footer-copy">Find something worth watching. Faster.</p>
        </div>

        <nav className="site-footer-nav" aria-label="Footer">
          <div className="site-footer-links" aria-label="Footer">
            {footerLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={link.secondary ? "site-footer-link site-footer-link--secondary" : "site-footer-link"}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="site-footer-bottom-bar">
          <p className="site-footer-credit">
            Built by <a href="https://jonnyegan.com" target="_blank" rel="noreferrer">Jonny Egan</a> using <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a> &amp; <a href="https://openai.com/" target="_blank" rel="noreferrer">OpenAI</a>
          </p>
          <div className="site-footer-version" aria-label={`Current site version ${SITE_VERSION}`}>{SITE_VERSION}</div>
        </div>
      </div>
    </footer>
  );
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
    <div className="app-shell">
      <SiteHeader />
      <main className="site-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/now-playing" element={<Home routeView="latest" isFeedRoute />} />
          <Route path="/trending" element={<Home routeView="popular" isFeedRoute />} />
          <Route path="/coming-soon" element={<Home routeView="upcoming" isFeedRoute />} />
          <Route path="/browse" element={<BrowseLibrary />} />
          <Route path="/my-movies" element={<MyMovies />} />
          <Route path="/account" element={<AccountSettings />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/how-reelbot-works" element={<HowReelbotWorks />} />
          <Route path="/movie/:id" element={<MovieDetails />} />
          <Route path="/movies/:id/:slug" element={<MovieDetails />} />
          <Route path="/movies/:id" element={<MovieDetails />} />
          <Route path="/person/:personId" element={<PersonDetails />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
      <CookieNotice />
      <AuthModal />
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
      <AuthProvider>
        <QueryRedirectGuard />
      </AuthProvider>
    </Router>
  );
}

export default App;
