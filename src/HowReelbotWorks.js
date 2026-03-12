import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function HowReelbotWorks() {
  const structuredData = useMemo(
    () => [
      buildBreadcrumbJsonLd([
        { name: "Home", path: "/" },
        { name: "How ReelBot Works", path: "/how-reelbot-works" },
      ]),
    ],
    []
  );

  usePageMetadata({
    title: "How ReelBot Works | ReelBot",
    description:
      "Learn how ReelBot combines TMDB movie data, vibe prompts, and AI ranking to recommend what to watch faster.",
    path: "/how-reelbot-works",
    structuredData,
  });

  return (
    <div className="browse-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <div className="browse-kicker">How ReelBot Works</div>
            <h1 className="browse-title">How ReelBot chooses what to watch</h1>
            <p className="browse-subtitle browse-subtitle--hero">
              ReelBot combines TMDB movie data, vibe prompts, and AI ranking so you can decide faster without digging through noise.
            </p>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">The short version</h2>
              <p className="section-subtitle">ReelBot starts with real movie data, filters weak candidates, then uses AI to rank and explain the best fit.</p>
            </div>
          </div>
          <div className="capability-grid">
            <article className="capability-card">
              <div className="capability-title">1. You give the vibe</div>
              <p className="capability-copy">Prompts like “smart sci-fi” or “tense but not miserable” help ReelBot narrow tone, pacing, and emotional weight.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">2. TMDB supplies the movie pool</div>
              <p className="capability-copy">ReelBot pulls from TMDB feeds and discovery endpoints so recommendations are grounded in real movie data.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">3. Signal filtering removes junk</div>
              <p className="capability-copy">Popularity, votes, release status, posters, and recency all help suppress weak low-signal results without hiding important new releases.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">4. AI ranks, not invents</div>
              <p className="capability-copy">OpenAI ranks a curated set of candidates and explains the movie qualities that make the top pick worth considering.</p>
            </article>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">What the actions do</h2>
              <p className="section-subtitle">Your interactions help ReelBot make smarter future picks in this browser.</p>
            </div>
          </div>
          <div className="capability-grid">
            <article className="capability-card">
              <div className="capability-title">Save</div>
              <p className="capability-copy">Keeps a movie around for later and teaches ReelBot what you are open to revisiting.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Seen</div>
              <p className="capability-copy">Stops ReelBot from resurfacing movies you have already watched.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Skip</div>
              <p className="capability-copy">Helps ReelBot learn what you do not want to see again in future picks.</p>
            </article>
            <article className="capability-card">
              <div className="capability-title">Ask ReelBot</div>
              <p className="capability-copy">Spoiler-light quick takes, viewer-fit answers, and next-watch guidance help you decide with less second-guessing.</p>
            </article>
          </div>
        </section>

        <section className="detail-info-card">
          <div className="section-header section-header--compact section-header--stacked-mobile">
            <div>
              <h2 className="section-title">Why the site has both feeds and picks</h2>
              <p className="section-subtitle">Sometimes you want a quick answer. Sometimes you want to browse. ReelBot supports both.</p>
            </div>
          </div>
          <p className="detail-secondary-text">
            Use the homepage picker when you want one strong recommendation fast. Use feed pages and Browse when you want to scan what is now playing, trending, or coming soon before asking ReelBot to narrow the list.
          </p>
          <div className="browse-hero-actions" style={{ marginTop: 18 }}>
            <Link to="/" className="reelbot-inline-button reelbot-inline-button--solid">Try the homepage picker</Link>
            <Link to="/browse" className="reelbot-inline-button">Open Browse</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HowReelbotWorks;
