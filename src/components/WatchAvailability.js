import React from "react";

const GROUP_LABELS = {
  subscription: "Included with subscription",
  rent: "Available to rent",
  buy: "Available to buy",
};

const getProviderGroups = (availability) =>
  ["subscription", "rent", "buy"]
    .map((group) => ({
      id: group,
      label: GROUP_LABELS[group],
      providers: Array.isArray(availability?.[group]) ? availability[group] : [],
    }))
    .filter((group) => group.providers.length);

function WatchAvailability({ availability, sectionId }) {
  const providerGroups = getProviderGroups(availability);
  const hasProviders = providerGroups.length > 0;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--providers">
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
          <div className="detail-description-label">Streaming info is not posted yet</div>
          <p className="detail-secondary-text">
            When provider data is available, you will see subscription, rental, and purchase options here.
          </p>
        </div>
      )}
    </section>
  );
}

export default WatchAvailability;
