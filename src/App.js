import { lazy, Suspense, useCallback, useEffect, useState } from "react";
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
const AdminPanel = lazy(() => import("./AdminPanel"));
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
    { label: "Pick for me", to: "/#pick-for-me", isActive: isAskReelbotActive },
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
  const [pastHero, setPastHero] = useState(location.pathname !== "/");

  useEffect(() => {
    if (location.pathname !== "/") {
      setPastHero(true);
      return undefined;
    }
    const hero = document.getElementById("pick-for-me");
    if (!hero) { setPastHero(false); return undefined; }
    const update = () => setPastHero(window.scrollY > Math.max(140, hero.offsetHeight * 0.28));
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [location.pathname]);

  const items = [
    { label: "Pick for me", to: "/#pick-for-me", active: location.pathname === "/" },
    { label: "Browse", to: "/browse", active: location.pathname === "/browse" },
    { label: "Collections", to: "/collections", active: location.pathname.startsWith("/collections") },
    { label: "My Movies", to: "/my-movies", active: location.pathname === "/my-movies" },
  ];

  const openAskReelBot = () => {
    window.dispatchEvent(new CustomEvent("reelbot:open-ask"));
  };

  return (
    <div className={`mobile-bottom-dock${pastHero ? " is-visible" : " is-hero-hidden"}`}>
      <button
        type="button"
        className="mobile-ask-launcher"
        onClick={openAskReelBot}
        aria-label="Ask ReelBot about this page"
      >
        <span className="mobile-ask-launcher-mark" aria-hidden="true">✦</span>
        <span className="mobile-ask-launcher-label">Ask ReelBot</span>
      </button>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {items.map((item) => (
          <NavLink key={item.label} to={item.to} className={"mobile-bottom-nav-item" + (item.active ? " is-active" : "")}>
            <span className="mobile-bottom-nav-icon" aria-hidden="true"></span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
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

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    }

    setDismissed(true);
  }, []);

  useEffect(() => {
    if (dismissed || typeof window === "undefined") return undefined;
    const startY = window.scrollY;
    const handleScroll = () => {
      if (Math.abs(window.scrollY - startY) >= 24) handleDismiss();
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissed, handleDismiss]);

  if (dismissed) {
    return null;
  }

  return (
    <div className="cookie-notice" role="status" aria-live="polite">
      <p className="cookie-notice-copy">ReelBot uses cookies to improve performance and understand usage. Scroll to continue.</p>
      <button type="button" className="cookie-notice-button" onClick={handleDismiss} aria-label="Dismiss cookie notice">
        Dismiss
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
              <Route path="/admin" element={<AdminPanel />} />
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
        <style>{`
          /* Mobile/Fold dock: navigation is navigation; Ask ReelBot is a contextual tool. */
          @media (max-width: 900px) {
            .ask-reelbot-trigger,
            .detail-floating-reelbot {
              display: none !important;
            }

            .mobile-bottom-dock {
              position: fixed;
              z-index: 1190;
              left: 50%;
              bottom: max(8px, env(safe-area-inset-bottom));
              width: min(calc(100% - 24px), 760px);
              transform: translate(-50%, 0);
              opacity: 1;
              visibility: visible;
              transition:
                opacity .46s cubic-bezier(.2,.72,.2,1),
                transform .46s cubic-bezier(.2,.72,.2,1),
                visibility .46s ease;
            }

            .mobile-bottom-dock.is-hero-hidden {
              opacity: 0;
              visibility: hidden;
              pointer-events: none;
              transform: translate(-50%, 30px);
            }

            .mobile-bottom-nav {
              position: relative !important;
              left: auto !important;
              right: auto !important;
              top: auto !important;
              bottom: auto !important;
              inset: auto !important;
              display: grid !important;
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              width: 100% !important;
              min-height: 64px;
              padding: 6px !important;
              border-radius: 20px !important;
            }

            .mobile-bottom-nav-item {
              min-width: 0 !important;
              padding: 7px 4px;
              text-align: center;
            }

            .mobile-bottom-nav-item:nth-child(1) .mobile-bottom-nav-icon::before { content: "✦" !important; }
            .mobile-bottom-nav-item:nth-child(2) .mobile-bottom-nav-icon::before { content: "#" !important; }
            .mobile-bottom-nav-item:nth-child(3) .mobile-bottom-nav-icon::before { content: "▦" !important; }
            .mobile-bottom-nav-item:nth-child(4) .mobile-bottom-nav-icon::before { content: "♡" !important; }

            .mobile-ask-launcher {
              position: absolute;
              right: 18px;
              bottom: calc(100% - 1px);
              display: inline-flex;
              align-items: center;
              gap: 7px;
              min-height: 38px;
              padding: 8px 13px 9px;
              border: 1px solid rgba(232,180,91,.3);
              border-bottom-color: rgba(255,255,255,.08);
              border-radius: 15px 15px 5px 5px;
              color: #f3c76c;
              background: rgba(10,11,16,.96);
              box-shadow: 0 -8px 24px rgba(0,0,0,.2);
              backdrop-filter: blur(18px);
              -webkit-backdrop-filter: blur(18px);
              font: 650 .78rem/1 inherit;
              letter-spacing: -.01em;
              cursor: pointer;
            }

            .mobile-ask-launcher::after {
              content: "";
              position: absolute;
              left: 10px;
              right: 10px;
              bottom: -1px;
              height: 1px;
              background: rgba(10,11,16,.96);
            }

            .mobile-ask-launcher-mark {
              font-size: .9rem;
              line-height: 1;
            }

            .mobile-ask-launcher:focus-visible {
              outline: 2px solid rgba(240,189,87,.7);
              outline-offset: 2px;
            }

            .home-page .home-hero .pick-prompt-shell {
              border-radius: 12px !important;
              overflow: hidden;
            }

            .home-page .home-hero .pick-prompt-input {
              border-radius: 11px !important;
            }

            .site-header .site-auth-trigger {
              display: none !important;
            }

            .reelbot-brand-logo {
              width: 102px !important;
              height: 40px !important;
              transform: translateY(-3px);
            }

            .site-menu-toggle {
              border-color: rgba(255,255,255,.09) !important;
              background: rgba(12,18,28,.72) !important;
              box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
            }

            .site-menu-toggle.is-open {
              border-color: rgba(240,189,87,.2) !important;
              background: rgba(17,22,31,.96) !important;
            }

            .site-nav-shell {
              top: calc(100% + 8px) !important;
              left: 8px !important;
              right: 8px !important;
              padding: 10px !important;
              border: 1px solid rgba(255,255,255,.08) !important;
              border-radius: 18px !important;
              background: rgba(8,11,17,.985) !important;
              box-shadow: 0 24px 70px rgba(0,0,0,.5) !important;
              backdrop-filter: blur(24px);
              -webkit-backdrop-filter: blur(24px);
            }

            .site-nav--mobile {
              display: grid !important;
              gap: 2px !important;
            }

            .site-nav--mobile .site-nav-link {
              min-height: 48px;
              padding: 0 14px !important;
              border: 0 !important;
              border-radius: 11px !important;
              color: rgba(239,230,217,.68) !important;
              background: transparent !important;
              font-size: .92rem;
              font-weight: 620;
            }

            .site-nav--mobile .site-nav-link.is-active {
              color: #f3c76c !important;
              background: rgba(240,189,87,.07) !important;
            }

            .site-nav--mobile .site-nav-account-link {
              margin-top: 6px;
              justify-content: center !important;
              color: #171108 !important;
              background: linear-gradient(135deg,#f2c55f,#dfa13d) !important;
              font-weight: 750;
            }
          }

          @media (max-width: 430px) {
            .mobile-bottom-dock {
              width: calc(100% - 20px);
            }

            .mobile-bottom-nav {
              min-height: 60px;
              border-radius: 18px !important;
            }

            .mobile-bottom-nav-item {
              font-size: .63rem !important;
              gap: 3px !important;
            }

            .mobile-ask-launcher {
              right: 10px;
              min-height: 36px;
              padding: 7px 11px 8px;
              font-size: .74rem;
            }
          }

          @media (max-width: 350px) {
            .mobile-ask-launcher-label {
              position: absolute;
              width: 1px;
              height: 1px;
              overflow: hidden;
              clip: rect(0 0 0 0);
              white-space: nowrap;
            }

            .mobile-ask-launcher {
              width: 38px;
              justify-content: center;
              padding-left: 0;
              padding-right: 0;
            }

            .mobile-bottom-nav-item {
              font-size: .59rem !important;
            }
          }
        `}</style>
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
