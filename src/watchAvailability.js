import {safeProviderUrl} from './streamingLinks';
export const WATCH_GROUPS = ['subscription','rent','buy','free','cable'];
const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g,'');
// Explicit equivalent storefront/channel names only. Do not collapse base
// subscriptions, ad-supported plans, premium tiers, or channel subscriptions.
const ALIASES = {
 amazon:'amazonvideo', appletv:'appletvstore', primevideo:'amazonprimevideo',
 paramountviaamazonprime:'paramountamazonchannel', paramountrokuchannel:'paramountrokupremiumchannel',
 vudu:'fandangoathome', hbomax:'max',
};
export const providerIdentity = name => ALIASES[compact(name)] || compact(name);
const providerLogo = (provider, candidates) => {
  if (provider.logo_path) return provider.logo_path;
  const identity = providerIdentity(provider.name);
  const match = candidates.find(item => providerIdentity(item.name) === identity && item.logo_path);
  if (match) return match.logo_path;
  // Branding only: Paramount's tier logos do not imply equivalent offers.
  if (identity === 'paramountplus') return candidates.find(item => ['paramountpluspremium','paramountplusessential'].includes(providerIdentity(item.name)) && item.logo_path)?.logo_path || null;
  return null;
};
export function mergeWatchAvailability(tmdb, watchmode) {
  const direct = watchmode?.source === 'watchmode' ? watchmode : null;
  const sameRegion = !direct || direct.region === tmdb?.region;
  const fallback = sameRegion ? tmdb : null;
  const logos = fallback ? WATCH_GROUPS.flatMap(group => fallback[group] || []) : [];
  const result = {...(direct || fallback),source:direct?'watchmode':'tmdb',has_tmdb_options:false};
  for (const group of WATCH_GROUPS) {
    const providers = [], seen = new Set();
    for (const provider of direct?.[group] || []) {
      const identity = providerIdentity(provider.name);
      if (seen.has(identity)) continue;
      const directUrl = safeProviderUrl(provider.direct_url);
      // An unusable direct URL must not swallow an independently listed option.
      if (!directUrl) continue;
      seen.add(identity);
      providers.push({...provider,direct_url:directUrl,logo_path:providerLogo(provider,logos),source:'watchmode',destination:'provider'});
    }
    for (const provider of fallback?.[group] || []) {
      const identity = providerIdentity(provider.name);
      if (seen.has(identity)) continue;
      seen.add(identity);
      providers.push({...provider,logo_path:providerLogo(provider,logos),source:'tmdb',destination:'tmdb'});
      result.has_tmdb_options = true;
    }
    result[group] = providers;
  }
  return result;
}
