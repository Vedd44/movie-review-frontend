export const PROVIDER_ACTION_LABELS = {
  subscription: 'Watch',
  rent: 'Rent',
  buy: 'Buy',
  transactional: 'Watch',
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

export const getProviderCtaLabel = (provider) => {
  const action = PROVIDER_ACTION_LABELS[provider?.access_type] || 'Watch';
  return `${action} on ${provider?.name || 'provider'}`;
};

export const buildProviderLink = ({ movieId, provider, availability }) => {
  void movieId;
  void provider;
  return availability?.link || '#';
};
