import React from "react";

const GROUP_LABELS = {
  subscription: "Included with subscription",
  transactional: "Rent or Buy",
};

const mergeProviders = (...groups) => {
  const seen = new Map();

  groups.flat().forEach((provider) => {
    if (!provider?.id || seen.has(provider.id)) {
      return;
    }

    seen.set(provider.id, provider);
  });

  return Array.from(seen.values());
};

const getProviderGroups = (availability) => {
  const subscription = Array.isArray(availability?.subscription) ? availability.subscription : [];
  const rent = Array.isArray(availability?.rent) ? availability.rent : [];
  const buy = Array.isArray(availability?.buy) ? availability.buy : [];

  return [
    {
      id: "subscription",
      label: GROUP_LABELS.subscription,
      providers: subscription,
    },
    {
      id: "transactional",
      label: GROUP_LABELS.transactional,
      providers: mergeProviders(rent, buy),
    },
  ].filter((group) => group.providers.length);
};

function WatchAvailability({ availability, sectionId }) {
  const providerGroups = getProviderGroups(availability);
  const hasProviders = providerGroups.length > 0;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--providers detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count">
        <div>
          <h2 className="detail-section-title">Where to Watch</h2>
          <p className="detail-secondary-text">
            {hasProviders
              ? `Streaming and rental options for ${availability.region || "your region"}.`
              : "Streaming and rental options will show up here when they are available."}
          </p>
        </div>
        {availability?.region ? <div className="results-count">{availability.region}</div> : null}
      </div>

      {hasProviders ? (
        <div className="provider-group-stack">
          {providerGroups.map((group) => (
            <div key={group.id} className="provider-group">
              <div className="detail-description-label">{group.label}</div>
              <div className="provider-chip-row">
                {group.providers.map((provider) => (
                  <div key={`${group.id}-${provider.id}`} className="provider-chip">
                    {provider.logo_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.name}
                        className="provider-chip-logo"
                      />
                    ) : null}
                    <span className="provider-chip-name">{provider.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {availability?.link ? (
            <a href={availability.link} target="_blank" rel="noreferrer" className="detail-text-action">
              See all viewing options
            </a>
          ) : null}
        </div>
      ) : (
        <div className="provider-placeholder">
          <div className="detail-description-label">Streaming availability is not listed yet.</div>
          <p className="detail-secondary-text">
            When providers add this movie, you'll see rental, purchase, and subscription options here.
          </p>
        </div>
      )}
    </section>
  );
}

export default WatchAvailability;
