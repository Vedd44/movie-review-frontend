import React, { useState } from "react";
import { Link } from "react-router-dom";
import FeedbackModal from "./components/FeedbackModal";
import legalCopy from "./legalCopy.json";
import { usePageMetadata } from "./seo";

export default function LegalPage({ kind }) {
  const page = legalCopy[kind];
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  usePageMetadata({ title: `${page.title} | ReelBot`, description: page.description, path: page.path });
  return (
    <div className="browse-page legal-page">
      <article className="container legal-shell">
        <Link to="/" className="legal-back">Back to ReelBot</Link>
        <header>
          <h1>{page.title}</h1>
          <p className="legal-updated">Updated {page.updated}</p>
          <p>{page.description}</p>
        </header>
        {page.sections.map(([heading, ...paragraphs]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            {paragraphs.map(text => <p key={text}>{text}</p>)}
          </section>
        ))}
        <nav className="legal-page-links" aria-label="Policy links">
          <Link to={kind === "privacy" ? "/terms" : "/privacy"}>{kind === "privacy" ? "Terms of Service" : "Privacy Policy"}</Link>
          <button type="button" onClick={() => setFeedbackOpen(true)}>Contact ReelBot</button>
        </nav>
      </article>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
