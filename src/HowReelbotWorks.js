import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function HowReelbotWorks() {
  const structuredData = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "How it works", path: "/how-reelbot-works" },
      ]),
    ],
    []
  );

  usePageMetadata({
    title: "How it works | ReelBot",
    description:
      "See how ReelBot turns your taste into a stronger movie pick.",
    path: "/how-reelbot-works",
    structuredData,
  });

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">How it works</div>
            <h1 className="browse-title">How ReelBot narrows the pick</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              ReelBot uses real movie data, your signals, and AI ranking to get to a stronger pick faster.
            </p>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">The short version</h2>
              <p className="section-subtitle">ReelBot starts with real movie data, filters weak options, then ranks the strongest fit.</p>
            </div>
          </div>
          <div className="capability-grid">
            <article className="capability-card">
              <div className="capability-title">1. You give the vibe</div>
              <p className="capability-copy">A short prompt gives ReelBot tone, pace, and weight.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">2. TMDB builds the pool</div>
              <p className="capability-copy">ReelBot pulls from TMDB so every pick starts from real movie data.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">3. Weak options get filtered out</div>
              <p className="capability-copy">Popularity, votes, release status, posters, and recency help ReelBot cut low-signal results.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">4. AI ranks, not invents</div>
              <p className="capability-copy">OpenAI ranks the shortlist and explains why the top pick is worth your time.</p>
            </article>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">What the actions do</h2>
              <p className="section-subtitle">Your actions help ReelBot keep the next pick sharper.</p>
            </div>
          </div>
          <div className="capability-grid">
            <article className="capability-card">
              <div className="capability-title">Save</div>
              <p className="capability-copy">Keeps a movie around for later.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Seen</div>
              <p className="capability-copy">Keeps ReelBot from surfacing movies you already watched.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Not for me</div>
              <p className="capability-copy">Tells ReelBot not to show that movie again.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Ask ReelBot</div>
              <p className="capability-copy">Quick takes and fit checks help you decide faster.</p>
            </article>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">Why the site has both feeds and picks</h2>
              <p className="section-subtitle">Sometimes you want one strong pick. Sometimes you want to browse.</p>
            </div>
          </div>
          <p className="detail-secondary-text">
            Use the homepage when you want a strong pick fast. Use the feeds and Browse when you want a wider scan first.
          </p>
          <div className="browse-hero-actions" style={{ marginTop: 18 }}>
            <Link to="/" className="reelbot-inline-button reelbot-inline-button--solid">Get a pick</Link>
            <Link to="/browse" className="reelbot-inline-button">Open Browse</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HowReelbotWorks;
