import {
  MOOD_FILTERS,
  PICK_COMPANY_OPTIONS,
  PICK_RUNTIME_OPTIONS,
} from "./discovery";

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

const moodLookup = byId(MOOD_FILTERS);
const runtimeLookup = byId(PICK_RUNTIME_OPTIONS);
const companyLookup = byId(PICK_COMPANY_OPTIONS);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getSourceLabel = (preferences) =>
  preferences.source === "library"
    ? "Full library"
    : "Tonight's feed";

const getMoodReason = (moodId) => {
  switch (moodId) {
    case "easy_watch":
      return "Easy to settle into without making the night feel heavy.";
    case "mind_bending":
      return "Sharper and more idea-driven than a generic safe pick.";
    case "dark":
      return "Keeps the intensity up without leaning on pure shock value.";
    case "funny":
      return "Keeps enough lift in the tone to play smoothly tonight.";
    case "feel_something":
      return "Emotional and rewarding rather than purely draining.";
    default:
      return "Feels like the right overall lane for tonight.";
  }
};

const getCompanyReason = (companyId) => {
  switch (companyId) {
    case "solo":
      return "Strong enough to hold attention when you are watching alone.";
    case "pair":
      return "More likely to work as a shared watch than something too abrasive or niche.";
    case "friends":
      return "Broad enough to get a room on the same page quickly.";
    default:
      return "Easy to say yes to without overthinking it.";
  }
};

const getRuntimeReason = (runtimeId) => {
  switch (runtimeId) {
    case "under_two_hours":
      return "Fits the night cleanly without taking over the whole evening.";
    case "over_two_hours":
      return "Has enough scope to justify a longer sit-down watch.";
    default:
      return "Runtime should not be the thing that knocks it out.";
  }
};

const getConfidenceLabel = (score) => {
  if (score >= 89) {
    return "Top pick";
  }

  if (score >= 81) {
    return "Strong match";
  }

  if (score >= 73) {
    return "Good match";
  }

  return "Worth a look";
};

export const buildRecommendationRationale = ({ pickResult, activePick }) => {
  if (!pickResult?.primary || !activePick) {
    return null;
  }

  const preferences = {
    view: "latest",
    source: "feed",
    mood: "all",
    runtime: "any",
    company: "any",
    prompt: "",
    ...(pickResult.resolved_preferences || {}),
  };

  const criteria = [{ key: "source", label: getSourceLabel(preferences) }];

  if (preferences.runtime !== "any" && runtimeLookup[preferences.runtime]) {
    criteria.push({ key: "runtime", label: runtimeLookup[preferences.runtime].label });
  }

  if (preferences.company !== "any" && companyLookup[preferences.company]) {
    criteria.push({ key: "company", label: companyLookup[preferences.company].label });
  }

  if (preferences.mood !== "all" && moodLookup[preferences.mood]) {
    criteria.push({ key: "mood", label: moodLookup[preferences.mood].label });
  }

  if (preferences.prompt) {
    criteria.push({ key: "prompt", label: `“${preferences.prompt}”` });
  }

  let confidenceScore = Number(pickResult.match_score || activePick.match_score || 0);
  if (!confidenceScore) {
    confidenceScore = 70;
    if (preferences.runtime !== "any") confidenceScore += 4;
    if (preferences.company !== "any") confidenceScore += 4;
    if (preferences.mood !== "all") confidenceScore += 4;
    if (preferences.prompt) confidenceScore += 7;
    if (preferences.source === "feed") confidenceScore += 2;
    if (activePick.vote_average >= 7.8) confidenceScore += 5;
    else if (activePick.vote_average >= 6.8) confidenceScore += 3;
    else if (activePick.vote_average >= 6) confidenceScore += 1;
  }

  confidenceScore = clamp(confidenceScore, 66, 97);

  const whyRecommended = [];

  if (activePick.reason) {
    whyRecommended.push(activePick.reason);
  }

  if (preferences.runtime !== "any") {
    whyRecommended.push(getRuntimeReason(preferences.runtime));
  }

  if (preferences.company !== "any") {
    whyRecommended.push(getCompanyReason(preferences.company));
  }

  if (preferences.mood !== "all") {
    whyRecommended.push(getMoodReason(preferences.mood));
  }

  if (activePick.vote_average) {
    whyRecommended.push("Audience response keeps it feeling like a safer bet, not a random reach.");
  }

  return {
    title: "ReelBot's Pick for Tonight",
    heading: preferences.source === "library" ? "Best Match from the Library" : "Best Match for Tonight",
    criteriaTitle: "Signals used",
    assistantLabel: "Quick read",
    scoreLabel: "Match score",
    whyTitle: "Why this works",
    criteria,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    whyRecommended: [...new Set(whyRecommended)].slice(0, 3),
  };
};
