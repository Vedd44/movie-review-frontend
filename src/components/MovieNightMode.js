import React, { useMemo, useState } from "react";

const PEOPLE_OPTIONS = [
  { id: "couple", label: "2 people" },
  { id: "small_group", label: "3-4 people" },
  { id: "group", label: "5+ people" },
];

const ATTENTION_OPTIONS = [
  { id: "low", label: "Easygoing" },
  { id: "medium", label: "Balanced" },
  { id: "high", label: "Locked in" },
];

const RISK_OPTIONS = [
  { id: "safe", label: "Safe" },
  { id: "mixed", label: "Open-minded" },
  { id: "adventurous", label: "Go bold" },
];

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

const peopleLookup = byId(PEOPLE_OPTIONS);
const attentionLookup = byId(ATTENTION_OPTIONS);
const riskLookup = byId(RISK_OPTIONS);

const MODE_GROUPS = [
  {
    id: "people",
    label: "How many people?",
    options: PEOPLE_OPTIONS,
  },
  {
    id: "attention",
    label: "Attention level",
    options: ATTENTION_OPTIONS,
  },
  {
    id: "risk",
    label: "Safe or adventurous?",
    options: RISK_OPTIONS,
  },
];

function MovieNightMode({ onApply, loading = false }) {
  const [people, setPeople] = useState("couple");
  const [attention, setAttention] = useState("medium");
  const [risk, setRisk] = useState("safe");

  const summary = useMemo(() => `${peopleLookup[people].label} • ${attentionLookup[attention].label} • ${riskLookup[risk].label}`, [attention, people, risk]);

  const selectionMap = {
    people: [people, setPeople],
    attention: [attention, setAttention],
    risk: [risk, setRisk],
  };

  const handleApply = () => {
    const company = people === "couple" ? "pair" : "friends";
    const runtime = attention === "low" ? "under_two_hours" : attention === "high" ? "over_two_hours" : "any";
    const prompt = `${riskLookup[risk].label}, ${attentionLookup[attention].label.toLowerCase()}, and good for ${peopleLookup[people].label.toLowerCase()}.`;

    onApply({ company, runtime, prompt });
  };

  return (
    <section className="movie-night-mode-card">
      <div className="section-header section-header--compact section-header--stacked-mobile">
        <div>
          <div className="detail-description-label">Group picks</div>
          <h2 className="section-title">Movie Night Mode</h2>
          <p className="section-subtitle">Use this when the room needs one easy yes, not just your personal best-fit pick.</p>
        </div>
        <div className="results-count results-count--context">New</div>
      </div>

      <p className="movie-night-mode-note">ReelBot leans harder on group fit here, so the pick stays easier to agree on.</p>

      <div className="movie-night-mode-grid">
        {MODE_GROUPS.map((group) => {
          const [value, setValue] = selectionMap[group.id];

          return (
            <div key={group.id} className="movie-night-mode-group">
              <div className="detail-description-label">{group.label}</div>
              <div className="mood-chip-row">
                {group.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`mood-rail-chip${value === option.id ? " is-active" : ""}`}
                    onClick={() => setValue(option.id)}
                  >
                    <span className="mood-rail-chip-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="movie-night-mode-footer">
        <div className="movie-night-mode-summary-wrap">
          <div className="detail-description-label">Tonight&apos;s group setup</div>
          <p className="detail-secondary-text movie-night-mode-summary">{summary}</p>
        </div>
        <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={handleApply} disabled={loading}>
          {loading ? "Getting group pick..." : "Get group pick"}
        </button>
      </div>
    </section>
  );
}

export default MovieNightMode;
