import React from "react";
import { buildProviderLink, getProviderCtaLabel } from "../streamingLinks";

const GROUP_LABELS = {
  subscription: "Included with subscription",
  transactional: "Rent or buy",
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

function WatchAvailability({ availability, sectionId, movieId }) {
  const providerGroups = getProviderGroups(availability);
  const primaryProvider = providerGroups[0]?.providers?.[0] || null;
  const primaryHref = primaryProvider ? buildProviderLink({ movieId, provider: primaryProvider, availability }) : availability?.link || "#";
  const hasProviders = providerGroups.length > 0;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count">
        <div>
          <div className="detail-description-label">Watch now</div>
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
        <div className="watch-now-layout">
          <div className="watch-now-provider-grid">
            {providerGroups.map((group) => (
              <div key={group.id} className="provider-group provider-group--watch-now">
                <div className="detail-description-label">{group.label}</div>
                <div className="provider-chip-row provider-chip-row--cta">
                  {group.providers.map((provider) => {
                    const href = buildProviderLink({ movieId, provider, availability });
                    return (
                      <a
                        key={`${group.id}-${provider.id}`}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="provider-chip provider-chip--cta"
                        aria-label={getProviderCtaLabel(provider)}
                      >
                        {provider.logo_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                            alt={provider.name}
                            className="provider-chip-logo"
                          />
                        ) : null}
                        <span className="provider-chip-name">{provider.name}</span>
                        <span className="provider-chip-cta-copy">{getProviderCtaLabel(provider)}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {primaryProvider ? (
            <div className="watch-now-primary-cta-wrap">
              <a href={primaryHref} target="_blank" rel="noreferrer" className="detail-trailer-cta watch-now-primary-cta">
                {getProviderCtaLabel(primaryProvider)}
              </a>
              <p className="detail-secondary-text watch-now-primary-note">Provider links are ready for affiliate tags without changing the UI.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="provider-placeholder">
          <div className="detail-description-label">Streaming availability is not listed yet.</div>
          <p className="detail-secondary-text">
            When providers add this movie, you&apos;ll see rental, purchase, and subscription options here.
          </p>
        </div>
      )}
    </section>
  );
}

export default WatchAvailability;
