import React from 'react';
import { getProviderBadgeList } from '../streamingLinks';

function ProviderBadgeRow({ availability, badges, compact = false }) {
  const providerList = Array.isArray(badges) && badges.length ? badges : getProviderBadgeList(availability, compact ? 2 : 3);

  if (!providerList.length) {
    return null;
  }

  return (
    <div className={`provider-badge-row${compact ? ' provider-badge-row--compact' : ''}`}>
      {providerList.map((provider) => (
        <span key={provider.id || provider.name} className="provider-badge-pill" title={provider.name}>
          {provider.logo_path ? (
            <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt={provider.name} className="provider-badge-logo" />
          ) : null}
          <span className="provider-badge-name">{provider.name}</span>
        </span>
      ))}
    </div>
  );
}

export default ProviderBadgeRow;
