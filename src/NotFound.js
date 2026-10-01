import React from "react";
import { Link, useLocation } from "react-router-dom";
import { usePageMetadata } from "./seo";

export default function NotFound({ title = "Page not found" }) {
  const location = useLocation();
  usePageMetadata({ title: `${title} | ReelBot`, description: "This page could not be found. Explore movies and collections on ReelBot.", path: location.pathname, robots: "noindex,follow" });
  return <section className="container page-unavailable"><p className="browse-kicker">404</p><h1>{title}</h1><p>That link may have changed. Find your next movie below.</p><div className="page-recovery-links"><Link to="/browse" className="reelbot-inline-button">Browse movies</Link><Link to="/collections" className="detail-text-action">Explore collections</Link></div></section>;
}
