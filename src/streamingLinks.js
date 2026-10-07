export const PROVIDER_ACTION_LABELS = {
  subscription: "Watch",
  rent: "Rent",
  buy: "Buy",
  transactional: "Watch",
};

export const getPrimaryProviders = (availability) => {
  if (!availability) return [];
  const providers = [
    ...(Array.isArray(availability.subscription) ? availability.subscription : []),
    ...(Array.isArray(availability.rent) ? availability.rent : []),
    ...(Array.isArray(availability.buy) ? availability.buy : []),
  ];
  const seen = new Set();
  return providers.filter((provider) => {
    const id = Number(provider?.id || 0);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const getProviderBadgeList = (availability, limit = 2) => getPrimaryProviders(availability).slice(0, limit);
export const getProviderActionLabel = (provider) => PROVIDER_ACTION_LABELS[provider?.access_type] || "Watch";

export const getProviderCtaLabel = (providerLink = {}) => {
  const providerName = providerLink?.provider?.name || providerLink?.name || "provider";
  if (providerLink?.kind === "direct_provider") {
    return `${getProviderActionLabel(providerLink.provider || providerLink)} on ${providerName}`;
  }
  if (providerLink?.kind === "tmdb_availability") return "View availability on TMDB";
  return `Open on ${providerName}`;
};

export const buildProviderLink = ({ provider, availabilityLink }) => {
  const directLink = String(provider?.direct_link || provider?.deep_link || "").trim();
  if (isHttpsLink(directLink)) {
    return {
      kind: "direct_provider",
      href: directLink,
      provider,
      label: getProviderCtaLabel({ kind: "direct_provider", provider }),
    };
  }

  const availabilityAction = buildAvailabilityLink(availabilityLink);
  if (!availabilityAction) return null;
  return {
    ...availabilityAction,
    provider,
    label: `View ${provider?.name || "provider"} availability`,
  };
};

const isHttpsLink = value => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
};

export const buildAvailabilityLink = (availabilityLink = "") => {
  const href = String(availabilityLink || "").trim();
  if (!isHttpsLink(href) || !["www.themoviedb.org", "themoviedb.org"].includes(new URL(href).hostname)) return null;
  return href ? { kind: "tmdb_availability", href, label: "View availability" } : null;
};

export const safeProviderUrl = value => {
  if (!isHttpsLink(value)) return "";
  const url = new URL(value);
  // The API can include a third party's affiliate tags. Keep movie routing
  // parameters such as playableId and gti, while using ordinary outbound links.
  const affiliateKeys = /(^|\.)apple\.com$/.test(url.hostname)
    ? new Set(["at", "ct", "itscg", "itsct"])
    : /(^|\.)amazon\./.test(url.hostname)
      ? new Set(["tag", "ascsubtag", "linkcode", "linkid", "creative", "creativeasin", "camp"])
      : url.hostname === "play.google.com"
        ? new Set(["paffiliateid"])
        : new Set();
  for (const key of [...url.searchParams.keys()]) {
    if (affiliateKeys.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.href;
};

// Confirmed destination failures are filtered even when the source data is
// already cached. Do not rewrite or invent replacement movie destinations.
const UNAVAILABLE_YOUTUBE_VIDEOS = new Set(["SHoh9cb9fT8"]);
export const usableWatchProviderUrl = value => {
  const href = safeProviderUrl(value);
  if (!href) return "";
  const url = new URL(href);
  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  // Home pages, generic search pages, and live guides cannot open this movie.
  if (/^\/(?:[a-z]{2}\/)?(?:home|search|browse|live-tv|watch\/live-tv)?$/i.test(path)) return "";
  if (/(^|\.)pluto\.tv$/.test(host) && /\/(?:search|live-tv)(?:\/|$)/i.test(path)) return "";
  if (/(^|\.)philo\.com$/.test(host) && /\/player\/player(?:\/|$)/i.test(path)) return "";
  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") {
    const id = host === "youtu.be" ? path.slice(1) : url.searchParams.get("v");
    if (!id || UNAVAILABLE_YOUTUBE_VIDEOS.has(id)) return "";
  }
  return href;
};
