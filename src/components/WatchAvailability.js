import React from "react";
import { buildProviderLink, getProviderCtaLabel } from "../streamingLinks";
import useTasteProfile from "../hooks/useTasteProfile";

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
  const { actions } = useTasteProfile();
  const providerGroups = getProviderGroups(availability)
    .map((group) => ({
      ...group,
      providers: group.providers
        .map((provider) => ({
          ...provider,
          href: buildProviderLink({ movie, provider, region: availability?.region, availabilityLink: availability?.link }),
        }))
        .filter((provider) => provider.href),
    }))
    .filter((group) => group.providers.length);
  const hasProviders = providerGroups.length > 0;
  const primaryProvider = providerGroups[0]?.providers?.[0] || null;
  const primaryHref = primaryProvider?.href || null;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--utility detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
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
              onClick={() => actions.recordProviderClick(movie, primaryProvider, { placement: "watch_now_primary" })}
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
                        <span className="watch-now-external-glyph" aria-hidden="true">↗</span>
                      </div>
                      <span className="provider-chip-action">{getProviderCtaLabel(provider)}</span>
                      <span className="provider-chip-cta-copy">Watch now</span>
                    </>
                  );

                  return (
                    <a
                      key={`${group.id}-${provider.id}`}
                      href={provider.href}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="provider-chip provider-chip--cta"
                      aria-label={getProviderCtaLabel(provider)}
                      onClick={() => actions.recordProviderClick(movie, provider, { placement: group.id })}
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
