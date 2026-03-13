import React from "react";

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
          <ul>
            {(content.picks || []).map((item) => (
              <li key={`${item.title}-${item.role_label}`}>
                <strong>{item.title}</strong>
                <br />
                <em>{item.role_label}</em> — {item.reason}
              </li>
            ))}
          </ul>
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
