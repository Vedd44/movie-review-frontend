import React from "react";
import { buildAvailabilityLink } from "../streamingLinks";

const GROUP_LABELS = {
  subscription: "Streaming",
  rent: "Rent",
  buy: "Buy",
};

const getProviderGroups = (availability) => [
  { id: "subscription", label: GROUP_LABELS.subscription, providers: Array.isArray(availability?.subscription) ? availability.subscription : [] },
  { id: "rent", label: GROUP_LABELS.rent, providers: Array.isArray(availability?.rent) ? availability.rent : [] },
  { id: "buy", label: GROUP_LABELS.buy, providers: Array.isArray(availability?.buy) ? availability.buy : [] },
].filter((group) => group.providers.length);

function WatchAvailability({ availability, sectionId }) {
  const providerGroups = getProviderGroups(availability);
  const availabilityAction = buildAvailabilityLink(availability?.link);
  const regionLabel = availability?.region === "US" ? "the U.S." : availability?.region || "your region";

  return (
    <section id={sectionId} className="detail-info-card detail-info-card--utility detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count watch-now-head">
        <div>
          <div className="detail-description-label">Current availability</div>
          <h2 className="detail-section-title">Where to Watch</h2>
          <p className="detail-secondary-text">Availability reported for {regionLabel} and subject to change.</p>
        </div>
      </div>

      {providerGroups.length ? (
        <div className="watch-availability-list">
          {providerGroups.map((group) => (
            <div key={group.id} className="watch-availability-row">
              <h3>{group.label}</h3>
              <ul aria-label={`${group.label} providers`}>
                {group.providers.map((provider) => (
                  <li key={`${group.id}-${provider.id}`}>
                    {provider.logo_path ? <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" aria-hidden="true" loading="lazy" /> : null}
                    <span>{provider.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="detail-secondary-text watch-availability-empty">Streaming, rental, and purchase options are not listed for this title right now.</p>
      )}

      <div className="watch-availability-footer">
        {availabilityAction ? (
          <a href={availabilityAction.href} target="_blank" rel="noopener noreferrer sponsored" className="detail-text-action watch-now-primary-cta">
            See current viewing options <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <p className="detail-secondary-text watch-now-footnote">Provider data from JustWatch via TMDB.</p>
      </div>
    </section>
  );
}

export default WatchAvailability;
