import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function HowReelbotWorks() {
  const structuredData = useMemo(
    () => [buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "How it works", path: "/how-reelbot-works" }])],
    []
  );

  usePageMetadata({
    title: "How it works | ReelBot",
    description: "How ReelBot finds and ranks movie recommendations.",
    path: "/how-reelbot-works",
    structuredData,
  });

  return (
    <div className="browse-page how-it-works-page">
      <div className="container browse-shell">
        <section className="browse-hero browse-hero--compact browse-hero--solo">
          <div className="browse-copy">
            <h1 className="browse-title">How ReelBot works</h1>
          </div>
        </section>

        <section className="detail-info-card how-it-works-section">
          <h2 className="section-title">Get a recommendation</h2>
          <div className="how-it-works-steps">
            <article>
              <span>1</span>
              <div><strong>Tell ReelBot what you want</strong><p>Describe the mood, genre, pace, runtime, or whatever matters tonight.</p></div>
            </article>
            <article>
              <span>2</span>
              <div><strong>ReelBot finds the best matches</strong><p>It searches real movie data and ranks the strongest options for your request.</p></div>
            </article>
            <article>
              <span>3</span>
              <div><strong>Get one pick</strong><p>ReelBot gives you a recommendation, why it fits, and a few alternatives if you want them.</p></div>
            </article>
          </div>
          <div className="browse-hero-actions how-it-works-actions">
            <Link to="/" className="reelbot-inline-button reelbot-inline-button--solid">Ask ReelBot</Link>
            <Link to="/browse" className="reelbot-inline-button">Browse movies</Link>
          </div>
        </section>

        <section className="detail-info-card how-it-works-section">
          <h2 className="section-title">Make it yours</h2>
          <div className="how-it-works-features">
            <div><strong>Save</strong><span>Keep a movie for later.</span></div>
            <div><strong>Watched</strong><span>Keep movies you’ve seen out of future picks.</span></div>
            <div><strong>Not for me</strong><span>Tell ReelBot not to recommend it again.</span></div>
            <div><strong>Ask ReelBot</strong><span>Ask follow-up questions about a movie or recommendation.</span></div>
          </div>
        </section>

        <section className="how-it-works-note">
          <strong>Where the movie data comes from</strong>
          <p>ReelBot uses TMDB for movie information. AI helps interpret your request and rank the results; it doesn’t invent the movies.</p>
        </section>
      </div>
    </div>
  );
}

export default HowReelbotWorks;
