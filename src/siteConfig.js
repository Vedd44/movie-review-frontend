export const SITE_NAME = "ReelBot";
export const SITE_TAGLINE = "The AI movie companion";
export const SITE_DESCRIPTION = "Find what to watch tonight with ReelBot — an AI-powered movie picker that delivers fast recommendations, spoiler-light insights, and smarter next-watch suggestions.";
export const DEFAULT_SOCIAL_IMAGE = "/logo512.png";
const CANONICAL_SITE_ORIGIN = (process.env.REACT_APP_SITE_URL?.trim() || "https://reelbot.movie").replace(/\/$/, "");

export const getSiteOrigin = () => {
  if (typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location?.origin || "")) {
    return window.location.origin.replace(/\/$/, "");
  }

  return CANONICAL_SITE_ORIGIN;
};

export const buildAbsoluteUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteOrigin()}${normalizedPath}`;
};
