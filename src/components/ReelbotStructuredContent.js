import React from "react";
import { Link } from "react-router-dom";
import { getMoviePath, getReleaseYear } from "../discovery";

const formatNextWatchRoleLabel = (value = "") => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.includes("safer")) {
    return "Safer pick";
  }

  if (normalizedValue.includes("darker")) {
    return "Darker pick";
  }

  if (normalizedValue.includes("wildcard")) {
    return "Wildcard";
  }

  if (normalizedValue.includes("similar")) {
    return "Similar tone";
  }

  return value;
};

function ReelbotStructuredContent({ action, result }) {
  const content = result?.structured_content;

  if (!content) {
    return <div className="reelbot-body" dangerouslySetInnerHTML={{ __html: result?.content || "" }} />;
  }

  switch (action) {
    case "quick_take":
      return (
        <div className="reelbot-body">
          <p>{content.summary}</p>
          <p><strong>Who it’s for:</strong> {content.fit}</p>
          <p><strong>Watch note:</strong> {content.caution}</p>
        </div>
      );
    case "is_this_for_me":
      return (
        <div className="reelbot-body">
          <p><strong>Best for:</strong> {(content.best_for || []).join(" ")}</p>
          <p><strong>Maybe not for:</strong> {(content.maybe_not_for || []).join(" ")}</p>
          <p><strong>Commitment:</strong> {content.commitment}</p>
        </div>
      );
    case "why_watch":
      return (
        <div className="reelbot-body">
          <ol>
            {(content.reasons || []).map((item) => (
              <li key={item.label}><strong>{item.label}</strong> — {item.detail}</li>
            ))}
          </ol>
        </div>
      );
    case "best_if_you_want":
      return (
        <div className="reelbot-body">
          <ul>
            {(content.bullets || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      );
    case "similar_picks":
      return (
        <div className="reelbot-body reelbot-body--recommendations">
          <p>{content.intro}</p>
          <div className="reelbot-next-watch-list">
            {(content.picks || []).map((item) => {
              const hasMovieLink = Boolean(item.id);
              const Wrapper = hasMovieLink ? Link : "div";
              const wrapperProps = hasMovieLink ? { to: getMoviePath({ id: item.id, title: item.title }) } : {};

              return (
                <Wrapper
                  key={`${item.id || item.title}-${item.role_label}`}
                  className={`reelbot-next-watch-card${hasMovieLink ? " is-clickable" : ""}`}
                  {...wrapperProps}
                >
                  <div className="reelbot-next-watch-poster-shell">
                    {item.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                        alt={item.title}
                        className="reelbot-next-watch-poster"
                      />
                    ) : (
                      <div className="reelbot-next-watch-poster reelbot-next-watch-poster--placeholder">Poster unavailable</div>
                    )}
                  </div>
                  <div className="reelbot-next-watch-copy">
                    <div className="reelbot-next-watch-topline">
                      <div className="reelbot-next-watch-role">{formatNextWatchRoleLabel(item.role_label)}</div>
                      {hasMovieLink ? <div className="reelbot-next-watch-affordance">View details</div> : null}
                    </div>
                    <div className="reelbot-next-watch-title-row">
                      <div className="reelbot-next-watch-title">{item.title}</div>
                      {item.release_date ? <div className="reelbot-next-watch-year">{getReleaseYear(item.release_date)}</div> : null}
                    </div>
                    <p className="reelbot-next-watch-reason">{item.reason}</p>
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </div>
      );
    case "scary_check":
    case "pace_check":
      return (
        <div className="reelbot-body">
          <p><strong>Verdict:</strong> {content.verdict}</p>
          <ul>
            {(content.notes || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      );
    case "best_mood":
      return (
        <div className="reelbot-body">
          <p><strong>Best when:</strong> {content.best_when}</p>
          <p><strong>Best setup:</strong> {content.best_setup}</p>
        </div>
      );
    case "date_night":
      return (
        <div className="reelbot-body">
          <p><strong>Verdict:</strong> {content.verdict}</p>
          <p><strong>Why:</strong> {content.why}</p>
        </div>
      );
    case "spoiler_synopsis":
      return (
        <div className="reelbot-body">
          <ol>
            {(content.beats || []).map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      );
    case "ending_explained":
      return (
        <div className="reelbot-body">
          <p><strong>What happens:</strong> {content.what_happens}</p>
          <p><strong>What it means:</strong> {content.what_it_means}</p>
        </div>
      );
    case "themes_and_takeaways":
      return (
        <div className="reelbot-body">
          <ul>
            {(content.themes || []).map((item) => <li key={item.label}><strong>{item.label}</strong> — {item.detail}</li>)}
          </ul>
        </div>
      );
    case "debate_club":
      return (
        <div className="reelbot-body">
          <ol>
            {(content.points || []).map((item) => <li key={item.label}><strong>{item.label}</strong> — {item.detail}</li>)}
          </ol>
        </div>
      );
    default:
      return <div className="reelbot-body" dangerouslySetInnerHTML={{ __html: result?.content || "" }} />;
  }
}

export default ReelbotStructuredContent;
