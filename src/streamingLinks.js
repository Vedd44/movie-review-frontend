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

const slugifyProviderQuery = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getMovieQueryText = (movie = {}) => {
  const title = String(movie?.title || "").trim();
  const year = movie?.release_date ? new Date(movie.release_date).getFullYear() : "";
  return year ? `${title} ${year}` : title;
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
  amazon: (movie) => buildQueryUrl("https://www.amazon.com/s", { k: getMovieQueryText(movie), i: "instant-video" }),
  prime_video: (movie) => buildQueryUrl("https://www.amazon.com/s", { k: getMovieQueryText(movie), i: "instant-video" }),
  apple_tv: (movie) => buildQueryUrl("https://tv.apple.com/search", { term: getMovieQueryText(movie) }),
  google_play: (movie) => buildQueryUrl("https://play.google.com/store/search", { q: getMovieQueryText(movie), c: "movies" }),
  youtube: (movie) => buildQueryUrl("https://www.youtube.com/results", { search_query: `${getMovieQueryText(movie)} movie` }),
  netflix: (movie) => buildQueryUrl("https://www.netflix.com/search", { q: getMovieQueryText(movie) }),
  disney_plus: (movie) => `https://www.disneyplus.com/search/${encodeURIComponent(getMovieQueryText(movie))}`,
  hulu: (movie) => buildQueryUrl("https://www.hulu.com/search", { q: getMovieQueryText(movie) }),
  max: (movie) => buildQueryUrl("https://play.max.com/search", { q: getMovieQueryText(movie) }),
  peacock: (movie) => buildQueryUrl("https://www.peacocktv.com/search", { q: getMovieQueryText(movie) }),
  paramount_plus: (movie) => buildQueryUrl("https://www.paramountplus.com/search/", { searchTerm: getMovieQueryText(movie) }),
  vudu: (movie) => buildQueryUrl("https://www.vudu.com/content/movies/search", { searchString: getMovieQueryText(movie) }),
  microsoft: (movie) => buildQueryUrl("https://www.microsoft.com/en-us/search/shop/movies", { q: getMovieQueryText(movie) }),
  criterion_channel: (movie) => buildQueryUrl("https://www.criterionchannel.com/search", { q: getMovieQueryText(movie) }),
  mubi: (movie) => buildQueryUrl("https://mubi.com/search/films", { query: getMovieQueryText(movie) }),
  tubi: (movie) => `https://tubitv.com/search/${encodeURIComponent(getMovieQueryText(movie))}`,
  plex: (movie) => buildQueryUrl("https://watch.plex.tv/search", { q: getMovieQueryText(movie) }),
  kanopy: (movie) => buildQueryUrl("https://www.kanopy.com/en/search", { q: getMovieQueryText(movie) }),
  hoopla: (movie) => buildQueryUrl("https://www.hoopladigital.com/search", { q: getMovieQueryText(movie) }),
  amc_plus: (movie) => buildQueryUrl("https://www.amcplus.com/search", { text: getMovieQueryText(movie) }),
  starz: (movie) => `https://www.starz.com/us/en/search/${encodeURIComponent(getMovieQueryText(movie))}`,
  mgm_plus: (movie) => buildQueryUrl("https://www.mgmplus.com/search", { q: getMovieQueryText(movie) }),
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

export const getProviderCtaLabel = (provider) => `${getProviderActionLabel(provider)} on ${provider?.name || "provider"}`;

export const getStreamingLink = (movie, provider, region = "US") => {
  const providerKey = getProviderKey(provider);
  const builder = providerKey ? providerLinkBuilders[providerKey] : null;

  if (!builder || !movie?.title) {
    return null;
  }

  const nextUrl = builder(movie, provider, region);
  return applyAffiliateTemplate(providerKey, nextUrl);
};

export const buildProviderLink = ({ movie, provider, region }) => getStreamingLink(movie, provider, region);
