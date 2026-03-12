export const SITE_NAME = "ReelBot";
export const SITE_TAGLINE = "The AI movie companion";
export const SITE_DESCRIPTION = "ReelBot helps you decide what to watch faster with AI-powered movie picks, spoiler-light quick takes, review splits, and smarter next-watch recommendations.";
export const DEFAULT_SOCIAL_IMAGE = "/logo512.png";

export const getSiteOrigin = () => {
  const envUrl = process.env.REACT_APP_SITE_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "https://reelbot.app";
};

export const buildAbsoluteUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteOrigin()}${normalizedPath}`;
};
