const AMAZON_AFFILIATE_TAG = process.env.REACT_APP_AMAZON_AFFILIATE_TAG || "";
const APPLE_AFFILIATE_TOKEN = process.env.REACT_APP_APPLE_AFFILIATE_TOKEN || "";
const APPLE_CAMPAIGN_TOKEN = process.env.REACT_APP_APPLE_CAMPAIGN_TOKEN || "";
const GOOGLE_AFFILIATE_ID = process.env.REACT_APP_GOOGLE_AFFILIATE_ID || "";
const YOUTUBE_AFFILIATE_ID = process.env.REACT_APP_YOUTUBE_AFFILIATE_ID || "";
const FANDANGO_AFFILIATE_ID = process.env.REACT_APP_FANDANGO_AFFILIATE_ID || "";

export const PROVIDER_ACTION_LABELS = {
  subscription: "Watch",
  rent: "Rent",
  buy: "Buy",
  transactional: "Watch",
};

const PROVIDER_NAME_ALIASES = {
  "amazon video": "amazon",
  "prime video": "prime_video",
  "amazon prime video": "prime_video",
  "amazon prime": "prime_video",
  "apple tv": "apple_tv",
  "apple tv+": "apple_tv",
  "apple tv plus": "apple_tv",
  "google play movies": "google_play",
  "google play": "google_play",
  youtube: "youtube",
  "youtube movies": "youtube",
  netflix: "netflix",
  "disney plus": "disney_plus",
  disneyplus: "disney_plus",
  hulu: "hulu",
  max: "max",
  "hbo max": "max",
  "peacock premium": "peacock",
  peacock: "peacock",
  "paramount plus premium": "paramount_plus",
  "paramount plus essential": "paramount_plus",
  "paramount+": "paramount_plus",
  "paramount+ amazon channel": "paramount_plus",
  "paramount+ roku premium channel": "paramount_plus",
  "fandango at home": "vudu",
  vudu: "vudu",
  "microsoft store": "microsoft",
  "criterion channel": "criterion_channel",
  mubi: "mubi",
  tubi: "tubi",
  plex: "plex",
  kanopy: "kanopy",
  hoopla: "hoopla",
  "amc+": "amc_plus",
  starz: "starz",
  "mgm plus": "mgm_plus",
  "mgm+": "mgm_plus",
};

const PROVIDER_SEARCH_CONFIG = {
  amazon: { includeYear: true, fallbackToAvailability: true },
  prime_video: { includeYear: true, fallbackToAvailability: true },
  apple_tv: { includeYear: false, fallbackToAvailability: true },
  google_play: { includeYear: false, fallbackToAvailability: true },
  youtube: { includeYear: false, fallbackToAvailability: true },
  netflix: { includeYear: false, fallbackToAvailability: true },
  disney_plus: { includeYear: false, fallbackToAvailability: true },
  hulu: { includeYear: false, fallbackToAvailability: true },
  max: { includeYear: false, fallbackToAvailability: true },
  peacock: { includeYear: false, fallbackToAvailability: true },
  paramount_plus: { includeYear: false, fallbackToAvailability: true },
  vudu: { includeYear: false, fallbackToAvailability: true },
  microsoft: { includeYear: true, fallbackToAvailability: true },
  criterion_channel: { includeYear: false, fallbackToAvailability: true },
  mubi: { includeYear: false, fallbackToAvailability: true },
  tubi: { includeYear: false, fallbackToAvailability: true },
  plex: { includeYear: false, fallbackToAvailability: true },
  kanopy: { includeYear: false, fallbackToAvailability: true },
  hoopla: { includeYear: false, fallbackToAvailability: true },
  amc_plus: { includeYear: false, fallbackToAvailability: true },
  starz: { includeYear: false, fallbackToAvailability: true },
  mgm_plus: { includeYear: false, fallbackToAvailability: true },
};

const slugifyProviderQuery = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeMovieSearchText = (value = "") =>
  String(value || "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const getMovieQueryText = (movie = {}, options = {}) => {
  const title = String(movie?.title || "").trim();
  const year = movie?.release_date ? new Date(movie.release_date).getFullYear() : "";
  const normalizedTitle = normalizeMovieSearchText(title);

  if (!normalizedTitle) {
    return "";
  }

  return options.includeYear && year ? `${normalizedTitle} ${year}` : normalizedTitle;
};

const buildQueryUrl = (baseUrl, params = {}) => {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};

const applyAffiliateTemplate = (providerKey, urlString) => {
  if (!urlString) {
    return null;
  }

  const url = new URL(urlString);

  if ((providerKey === "amazon" || providerKey === "prime_video") && AMAZON_AFFILIATE_TAG) {
    url.searchParams.set("tag", AMAZON_AFFILIATE_TAG);
  }

  if (providerKey === "apple_tv") {
    if (APPLE_AFFILIATE_TOKEN) {
      url.searchParams.set("at", APPLE_AFFILIATE_TOKEN);
    }
    if (APPLE_CAMPAIGN_TOKEN) {
      url.searchParams.set("ct", APPLE_CAMPAIGN_TOKEN);
    }
  }

  if (providerKey === "google_play" && GOOGLE_AFFILIATE_ID) {
    url.searchParams.set("pcampaignid", GOOGLE_AFFILIATE_ID);
  }

  if (providerKey === "youtube" && YOUTUBE_AFFILIATE_ID) {
    url.searchParams.set("aff", YOUTUBE_AFFILIATE_ID);
  }

  if (providerKey === "vudu" && FANDANGO_AFFILIATE_ID) {
    url.searchParams.set("affid", FANDANGO_AFFILIATE_ID);
  }

  return url.toString();
};

export const getProviderKey = (provider) => {
  const normalizedName = String(provider?.name || provider?.provider_name || "")
    .toLowerCase()
    .replace(/[^a-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return PROVIDER_NAME_ALIASES[normalizedName] || slugifyProviderQuery(normalizedName) || null;
};

export const providerLinkBuilders = {
  amazon: (movie, provider, region, options = {}) => buildQueryUrl("https://www.amazon.com/s", { k: getMovieQueryText(movie, options), i: "instant-video" }),
  prime_video: (movie, provider, region, options = {}) => buildQueryUrl("https://www.amazon.com/s", { k: getMovieQueryText(movie, options), i: "instant-video" }),
  apple_tv: (movie, provider, region, options = {}) => buildQueryUrl(`https://tv.apple.com/${String(region || "us").toLowerCase()}/search`, { term: getMovieQueryText(movie, options) }),
  google_play: (movie, provider, region, options = {}) => buildQueryUrl("https://play.google.com/store/search", { q: getMovieQueryText(movie, options), c: "movies" }),
  youtube: (movie, provider, region, options = {}) => buildQueryUrl("https://www.youtube.com/results", { search_query: `${getMovieQueryText(movie, options)} movie` }),
  netflix: (movie, provider, region, options = {}) => buildQueryUrl("https://www.netflix.com/search", { q: getMovieQueryText(movie, options) }),
  disney_plus: (movie, provider, region, options = {}) => `https://www.disneyplus.com/search/${encodeURIComponent(getMovieQueryText(movie, options))}`,
  hulu: (movie, provider, region, options = {}) => buildQueryUrl("https://www.hulu.com/search", { q: getMovieQueryText(movie, options) }),
  max: (movie, provider, region, options = {}) => buildQueryUrl("https://play.max.com/search", { q: getMovieQueryText(movie, options) }),
  peacock: (movie, provider, region, options = {}) => buildQueryUrl("https://www.peacocktv.com/watch/search", { query: getMovieQueryText(movie, options) }),
  paramount_plus: (movie, provider, region, options = {}) => buildQueryUrl("https://www.paramountplus.com/search/", { searchTerm: getMovieQueryText(movie, options) }),
  vudu: (movie, provider, region, options = {}) => buildQueryUrl("https://athome.fandango.com/search", { query: getMovieQueryText(movie, options) }),
  microsoft: (movie, provider, region, options = {}) => buildQueryUrl("https://www.microsoft.com/en-us/search/shop/movies", { q: getMovieQueryText(movie, options) }),
  criterion_channel: (movie, provider, region, options = {}) => buildQueryUrl("https://www.criterionchannel.com/search", { q: getMovieQueryText(movie, options) }),
  mubi: (movie, provider, region, options = {}) => buildQueryUrl("https://mubi.com/search/films", { query: getMovieQueryText(movie, options) }),
  tubi: (movie, provider, region, options = {}) => `https://tubitv.com/search/${encodeURIComponent(getMovieQueryText(movie, options))}`,
  plex: (movie, provider, region, options = {}) => buildQueryUrl("https://watch.plex.tv/search", { q: getMovieQueryText(movie, options) }),
  kanopy: (movie, provider, region, options = {}) => buildQueryUrl("https://www.kanopy.com/en/search", { q: getMovieQueryText(movie, options) }),
  hoopla: (movie, provider, region, options = {}) => buildQueryUrl("https://www.hoopladigital.com/search", { q: getMovieQueryText(movie, options) }),
  amc_plus: (movie, provider, region, options = {}) => buildQueryUrl("https://www.amcplus.com/search", { text: getMovieQueryText(movie, options) }),
  starz: (movie, provider, region, options = {}) => `https://www.starz.com/us/en/search/${encodeURIComponent(getMovieQueryText(movie, options))}`,
  mgm_plus: (movie, provider, region, options = {}) => buildQueryUrl("https://www.mgmplus.com/search", { q: getMovieQueryText(movie, options) }),
};

const getAvailabilityFallbackLink = (availabilityLink = "") => {
  const trimmedLink = String(availabilityLink || "").trim();
  return trimmedLink || null;
};

export const getPrimaryProviders = (availability) => {
  if (!availability) {
    return [];
  }

  const groups = [
    ...(Array.isArray(availability.subscription) ? availability.subscription : []),
    ...(Array.isArray(availability.rent) ? availability.rent : []),
    ...(Array.isArray(availability.buy) ? availability.buy : []),
  ];

  const seen = new Set();
  return groups.filter((provider) => {
    if (!provider?.id || seen.has(provider.id)) {
      return false;
    }
    seen.add(provider.id);
    return true;
  });
};

export const getProviderBadgeList = (availability, limit = 2) => getPrimaryProviders(availability).slice(0, limit);

export const getProviderActionLabel = (provider) => PROVIDER_ACTION_LABELS[provider?.access_type] || "Watch";

export const getProviderCtaLabel = (providerLink = {}) => {
  const providerName = providerLink?.provider?.name || providerLink?.name || "provider";

  switch (providerLink?.kind) {
    case "direct_provider":
      return `${getProviderActionLabel(providerLink.provider || providerLink)} on ${providerName}`;
    case "provider_search":
      return `Search on ${providerName}`;
    case "tmdb_availability":
      return "View availability on TMDB";
    default:
      return `Open on ${providerName}`;
  }
};

export const getProviderSupportLabel = (providerLink = {}) => {
  switch (providerLink?.kind) {
    case "direct_provider":
      return "Direct title link";
    case "provider_search":
      return "Search results";
    case "tmdb_availability":
      return "TMDB availability";
    default:
      return "";
  }
};

export const getStreamingLink = (movie, provider, region = "US", availabilityLink = "") => {
  const providerKey = getProviderKey(provider);
  const builder = providerKey ? providerLinkBuilders[providerKey] : null;
  const providerConfig = providerKey ? PROVIDER_SEARCH_CONFIG[providerKey] || {} : {};
  const fallbackLink = getAvailabilityFallbackLink(availabilityLink);

  if (!movie?.title) {
    return fallbackLink;
  }

  if (!builder) {
    return fallbackLink;
  }

  try {
    const nextUrl = builder(movie, provider, region, { includeYear: providerConfig.includeYear === true });
    const withAffiliate = applyAffiliateTemplate(providerKey, nextUrl);

    if (withAffiliate) {
      return withAffiliate;
    }
  } catch (error) {
    console.error(`Failed to build provider link for ${provider?.name || providerKey}:`, error);
  }

  return providerConfig.fallbackToAvailability !== false ? fallbackLink : null;
};

export const buildProviderLink = ({ movie, provider, region, availabilityLink }) => {
  const directLink = String(provider?.direct_link || provider?.deep_link || "").trim();

  if (directLink) {
    return {
      kind: "direct_provider",
      href: directLink,
      provider,
      label: getProviderCtaLabel({ kind: "direct_provider", provider }),
    };
  }

  const providerSearchHref = getStreamingLink(movie, provider, region, "");
  if (providerSearchHref) {
    return {
      kind: "provider_search",
      href: providerSearchHref,
      provider,
      label: getProviderCtaLabel({ kind: "provider_search", provider }),
    };
  }

  const fallbackLink = String(availabilityLink || "").trim();
  if (fallbackLink) {
    return {
      kind: "tmdb_availability",
      href: fallbackLink,
      provider,
      label: getProviderCtaLabel({ kind: "tmdb_availability", provider }),
    };
  }

  return null;
};
