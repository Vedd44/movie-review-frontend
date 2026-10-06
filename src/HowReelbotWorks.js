import productCopy from "./productCopy";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { buildBreadcrumbJsonLd, usePageMetadata } from "./seo";

function HowReelbotWorks() {
  const structuredData = useMemo(
    () => [buildBreadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "How it works", path: "/how-reelbot-works" }])],
    []
  );

  usePageMetadata({
    title: productCopy.howTitle,
    description: productCopy.howIntro,
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
          <p>{productCopy.howIntro}</p>
          <div className="how-it-works-steps">
            {productCopy.steps.map(([title, copy], index) => <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{copy}</p></div></article>)}
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
            <div><strong>Watched</strong><span>Keep track of movies you’ve seen. We’ll prioritize new discoveries, with rewatches still available.</span></div>
            <div><strong>Not for me</strong><span>Tell ReelBot not to recommend it again.</span></div>
            <div><strong>Ask ReelBot</strong><span>Ask follow-up questions about a movie or recommendation.</span></div>
          </div>
        </section>

        <section className="how-it-works-note">
          <h2>{productCopy.faqQuestion}</h2>
          <p>{productCopy.faqAnswer}</p>
          <strong>Where the movie data comes from</strong>
          <p>{productCopy.ai}</p>
        </section>
      </div>
    </div>
  );
}

export default HowReelbotWorks;
