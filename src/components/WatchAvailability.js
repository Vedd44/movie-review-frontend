import React from "react";
import { buildAvailabilityLink, buildProviderLink, getProviderCtaLabel } from "../streamingLinks";
import useTasteProfile from "../hooks/useTasteProfile";

const GROUP_LABELS = {
  subscription: "Stream",
  rent: "Rent",
  buy: "Buy",
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
      id: "rent",
      label: GROUP_LABELS.rent,
      providers: rent,
    },
    {
      id: "buy",
      label: GROUP_LABELS.buy,
      providers: buy,
    },
  ].filter((group) => group.providers.length);
};

function WatchAvailability({ availability, sectionId, movie }) {
  const { actions } = useTasteProfile();
  const providerGroups = getProviderGroups(availability);
  const hasProviders = providerGroups.length > 0;
  const availabilityAction = buildAvailabilityLink(availability?.link);
  const regionLabel = availability?.region === "US" ? "the U.S." : availability?.region || "your region";

  if (!hasProviders && !availabilityAction) return null;

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--utility detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count watch-now-head">
        <div>
          <div className="detail-description-label">Watch options</div>
          <h2 className="detail-section-title">Where to Watch</h2>
          <p className="detail-secondary-text">
            {hasProviders
              ? `Availability reported for ${regionLabel}. Availability can change.`
              : "Current provider availability is not listed."}
          </p>
        </div>

        <div className="watch-now-head-actions">
          {availability?.region ? <div className="results-count">{availability.region}</div> : null}
          {availabilityAction ? (
            <a
              href={availabilityAction.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="detail-text-action watch-now-primary-cta"
              aria-label="View current availability"
            >
              View availability
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
                  const providerAction = buildProviderLink({
                    movie,
                    provider,
                    region: availability?.region,
                    availabilityLink: availability?.link,
                  });
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
                        {providerAction ? <span className="watch-now-external-glyph" aria-hidden="true">↗</span> : null}
                      </div>
                      <span className="provider-chip-action">{group.label}</span>
                    </>
                  );

                  return providerAction ? (
                    <a
                      key={`${group.id}-${provider.id}`}
                      href={providerAction.href}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="provider-chip provider-chip--cta"
                      aria-label={providerAction.label || getProviderCtaLabel(providerAction)}
                      onClick={() => {
                        void actions.recordProviderClick(movie, provider, { placement: group.id }).catch(() => {});
                      }}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={`${group.id}-${provider.id}`} className="provider-chip provider-chip--informational" aria-label={`${provider.name}, ${group.label}`}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <p className="detail-secondary-text watch-now-footnote">Data from JustWatch via TMDB.</p>
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
