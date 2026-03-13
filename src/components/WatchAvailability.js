import React from "react";
import { buildProviderLink, getProviderActionLabel, getProviderCtaLabel } from "../streamingLinks";

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

function WatchAvailability({ availability, sectionId, movie }) {
  const providerGroups = getProviderGroups(availability);
  const hasProviders = providerGroups.length > 0;
  const primaryProvider = providerGroups[0]?.providers?.[0] || null;
  const primaryHref = primaryProvider ? buildProviderLink({ movie, provider: primaryProvider, region: availability?.region }) : null;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count watch-now-head">
        <div>
          <div className="detail-description-label">Watch now</div>
          <h2 className="detail-section-title">Where to Watch</h2>
          <p className="detail-secondary-text">
            {hasProviders
              ? `Streaming and rental options for ${availability.region || "your region"}.`
              : "Streaming and rental options are not listed yet for this title."}
          </p>
        </div>

        <div className="watch-now-head-actions">
          {availability?.region ? <div className="results-count">{availability.region}</div> : null}
          {primaryProvider && primaryHref ? (
            <a
              href={primaryHref}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="detail-text-action watch-now-primary-cta"
              aria-label={getProviderCtaLabel(primaryProvider)}
            >
              {getProviderCtaLabel(primaryProvider)}
              <span className="watch-now-external-glyph" aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>
      </div>

      {hasProviders ? (
        <div className="watch-now-layout">
          {providerGroups.map((group) => (
            <div key={group.id} className="watch-now-group">
              <div className="watch-now-group-label">{group.label}</div>
              <div className="watch-now-provider-grid watch-now-provider-grid--grouped">
                {group.providers.map((provider) => {
                  const href = buildProviderLink({ movie, provider, region: availability?.region });
                  const content = (
                    <>
                      <div className="provider-chip-top">
                        <div className="provider-chip-brand">
                          {provider.logo_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                              alt={provider.name}
                              className="provider-chip-logo"
                            />
                          ) : null}
                          <span className="provider-chip-name">{provider.name}</span>
                        </div>
                        {href ? <span className="watch-now-external-glyph" aria-hidden="true">↗</span> : null}
                      </div>
                      <span className="provider-chip-action">{getProviderCtaLabel(provider)}</span>
                      <span className="provider-chip-cta-copy">{getProviderActionLabel(provider)} instantly in a new tab.</span>
                    </>
                  );

                  if (!href) {
                    return (
                      <div key={`${group.id}-${provider.id}`} className="provider-chip provider-chip--cta provider-chip--disabled" aria-label={`${provider.name} link unavailable`}>
                        {content}
                      </div>
                    );
                  }

                  return (
                    <a
                      key={`${group.id}-${provider.id}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="provider-chip provider-chip--cta"
                      aria-label={getProviderCtaLabel(provider)}
                    >
                      {content}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="detail-secondary-text watch-now-footnote">Links open in a new tab. Availability can change by region.</p>
        </div>
      ) : (
        <div className="provider-placeholder provider-placeholder--clean">
          <p className="detail-secondary-text">Streaming and rental options are not listed yet for this title.</p>
        </div>
      )}
    </section>
  );
}

export default WatchAvailability;
