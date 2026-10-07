import React, { useEffect, useRef, useState } from "react";
import "./WatchAvailability.css";
import { trackProductEvent } from "../analytics";
import { buildAvailabilityLink, safeProviderUrl } from "../streamingLinks";
import { mergeWatchAvailability } from "../watchAvailability";
import { fetchWatchmodeAvailability } from "../services/watchmodeService";

const GROUP_LABELS = {
  subscription: "Streaming",
  rent: "Rent",
  buy: "Buy",
  free: "Free",
  cable: "Cable subscription",
};

const getProviderGroups = (availability) => [
  { id: "subscription", label: GROUP_LABELS.subscription, providers: Array.isArray(availability?.subscription) ? availability.subscription : [] },
  { id: "rent", label: GROUP_LABELS.rent, providers: Array.isArray(availability?.rent) ? availability.rent : [] },
  { id: "buy", label: GROUP_LABELS.buy, providers: Array.isArray(availability?.buy) ? availability.buy : [] },
  { id: "free", label: GROUP_LABELS.free, providers: Array.isArray(availability?.free) ? availability.free : [] },
  { id: "cable", label: GROUP_LABELS.cable, providers: Array.isArray(availability?.cable) ? availability.cable : [] },
].filter((group) => group.providers.length);

function WatchAvailability({ availability, sectionId, movie }) {
  const sectionRef = useRef(null);
  const [enhanced, setEnhanced] = useState(null);
  const movieId = Number(movie?.id);
  useEffect(() => {
    if (!movieId || !sectionRef.current) return undefined;
    let active = true, started = false;
    const element = sectionRef.current;
    const load = async () => {
      if (started) return;
      started = true;
      const result = await fetchWatchmodeAvailability(movieId);
      if (!active) return;
      setEnhanced({id:movieId,availability:result});
      trackProductEvent("watch_options_viewed", {movie_id:movieId,source:result ? "watchmode" : "tmdb"});
    };
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); }
      });
      observer.observe(element);
      return () => { active = false; observer.disconnect(); };
    }
    const check = () => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom >= 0) void load();
    };
    check();
    window.addEventListener("scroll", check, {passive:true});
    window.addEventListener("resize", check);
    return () => { active = false; window.removeEventListener("scroll",check); window.removeEventListener("resize",check); };
  }, [movieId]);
  const watchedAvailability = enhanced?.id === movieId ? enhanced.availability : null;
  const displayed = mergeWatchAvailability(availability, watchedAvailability);
  const providerGroups = getProviderGroups(displayed);
  const source = watchedAvailability ? "watchmode" : "tmdb";
  const clickProperties = (provider, group) => ({movie_id:movieId || 0,provider_id:Number(provider.id)||0,provider_name:provider.name,availability_type:group,source:provider.source});
  const availabilityAction = buildAvailabilityLink(availability?.region === displayed?.region ? availability?.link : `https://www.themoviedb.org/movie/${movieId}/watch?locale=US`);
  const regionLabel = displayed?.region === "US" ? "the U.S." : displayed?.region || "your region";

  return (
    <section ref={sectionRef} id={sectionId} className="detail-info-card detail-info-card--utility detail-info-card--providers detail-info-card--watch-now detail-anchor-target">
      <div className="detail-section-head detail-section-head--with-count watch-now-head">
        <div>
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
                {group.providers.map((provider) => {
                  const direct = provider.destination === "provider";
                  const href = direct ? safeProviderUrl(provider.direct_url) : availabilityAction?.href;
                  const label = direct
                    ? `${group.id === "rent" ? "Rent" : group.id === "buy" ? "Buy" : "Watch"} on ${provider.name}`
                    : `View ${provider.name} options on TMDB`;
                  const icon = provider.logo_path ? <img src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`} alt="" aria-hidden="true" loading="lazy" /> : <span className="watch-provider-icon-placeholder" aria-hidden="true">{provider.name.charAt(0)}</span>;
                  return (
                    <li key={`${group.id}-${provider.source}-${provider.id}`}>
                      {href ? (
                        <a href={href}
                          onClick={() => trackProductEvent(direct ? "provider_clicked" : "viewing_options_clicked", clickProperties(provider, group.id))}
                          target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
                          className="watch-provider-link">
                          {icon}<span>{provider.name}{!direct ? <span className="watch-provider-options-label"> · options</span> : null} <span aria-hidden="true">↗</span></span>
                        </a>
                      ) : <>{icon}<span>{provider.name}</span></>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="detail-secondary-text watch-availability-empty">Streaming, rental, and purchase options are not listed for this title right now.</p>
      )}

      <div className="watch-availability-footer">
        {availabilityAction ? (
          <a onClick={() => trackProductEvent("viewing_options_clicked", { movie_id: Number(movie?.id) || 0, source })} href={availabilityAction.href} target="_blank" rel="noopener noreferrer" className="detail-text-action watch-now-primary-cta">
            See current viewing options <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <p className="detail-secondary-text watch-now-footnote">{watchedAvailability ? <>Streaming data powered by <a href="https://www.watchmode.com/" target="_blank" rel="noopener noreferrer">Watchmode</a>.{displayed.has_tmdb_options ? " Additional options from JustWatch via TMDB." : ""}</> : "Provider data from JustWatch via TMDB."}</p>
      </div>
    </section>
  );
}

export default WatchAvailability;
