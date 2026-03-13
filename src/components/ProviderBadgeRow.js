import React from 'react';
import { buildProviderLink, getProviderBadgeList } from '../streamingLinks';

function ProviderBadgeRow({ movie, region = 'US', availability, badges, compact = false, clickable = false }) {
  const providerList = Array.isArray(badges) && badges.length ? badges : getProviderBadgeList(availability, compact ? 2 : 3);

  if (!providerList.length) {
    return null;
  }

  return (
    <div className={`provider-badge-row${compact ? ' provider-badge-row--compact' : ''}`}>
      {providerList.map((provider) => {
        const href = clickable ? buildProviderLink({ movie, provider, region }) : null;
        const inner = (
          <>
            {provider.logo_path ? (
              <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt={provider.name} className="provider-badge-logo" />
            ) : null}
            <span className="provider-badge-name">{provider.name}</span>
          </>
        );

        if (clickable && href) {
          return (
            <a
              key={provider.id || provider.name}
              href={href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="provider-badge-pill provider-badge-pill--link"
              title={`Open ${provider.name}`}
            >
              {inner}
            </a>
          );
        }

        return (
          <span key={provider.id || provider.name} className="provider-badge-pill" title={provider.name}>
            {inner}
          </span>
        );
      })}
    </div>
  );
}

export default ProviderBadgeRow;
