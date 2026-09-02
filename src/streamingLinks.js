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
  if (directLink) {
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

export const buildAvailabilityLink = (availabilityLink = "") => {
  const href = String(availabilityLink || "").trim();
  return href ? { kind: "tmdb_availability", href, label: "View availability" } : null;
};
