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
    : "This page";

const getMoodReason = (moodId) => {
  switch (moodId) {
    case "easy_watch":
      return "Should be easy to get into without feeling too heavy.";
    case "mind_bending":
      return "Gives you something smart and twisty to chew on.";
    case "dark":
      return "Keeps the mood darker and more intense.";
    case "funny":
      return "Keeps enough humor in the mix to stay fun.";
    case "feel_something":
      return "Has a little more emotional pull if you want something that hits.";
    default:
      return "Feels like the right overall mood for tonight.";
  }
};

const getCompanyReason = (companyId) => {
  switch (companyId) {
    case "solo":
      return "Feels like a strong solo-watch pick.";
    case "pair":
      return "Feels better suited to date night than something too abrasive or demanding.";
    case "friends":
      return "Should play well with a group.";
    default:
      return "Feels easy to say yes to tonight.";
  }
};

const getRuntimeReason = (runtimeId) => {
  switch (runtimeId) {
    case "under_two_hours":
      return "Should fit the night without taking over the whole evening.";
    case "over_two_hours":
      return "Feels better if you want to settle into something bigger.";
    default:
      return "Works well when runtime is not the main concern.";
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

  const criteria = [
    { key: "source", label: getSourceLabel(preferences) },
  ];

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

  let confidenceScore = 70;
  if (preferences.runtime !== "any") confidenceScore += 4;
  if (preferences.company !== "any") confidenceScore += 4;
  if (preferences.mood !== "all") confidenceScore += 4;
  if (preferences.prompt) confidenceScore += 7;
  if (preferences.source === "feed") confidenceScore += 2;
  if (activePick.vote_average >= 7.8) confidenceScore += 5;
  else if (activePick.vote_average >= 6.8) confidenceScore += 3;
  else if (activePick.vote_average >= 6) confidenceScore += 1;

  confidenceScore = clamp(confidenceScore, 66, 94);

  const whyRecommended = [];

  if (preferences.runtime !== "any") {
    whyRecommended.push(getRuntimeReason(preferences.runtime));
  }

  if (preferences.company !== "any") {
    whyRecommended.push(getCompanyReason(preferences.company));
  }

  if (preferences.mood !== "all") {
    whyRecommended.push(getMoodReason(preferences.mood));
  }

  if (preferences.prompt) {
    whyRecommended.push("Feels close to the kind of movie you described.");
  }

  if (!whyRecommended.length) {
    whyRecommended.push("Feels like the best overall option for tonight.");
  }

  if (activePick.vote_average) {
    whyRecommended.push("It also has the kind of audience response that makes it feel like a safer bet.");
  }

  return {
    title: preferences.prompt ? "Recommended for Your Vibe" : "ReelBot’s Pick for Tonight",
    heading: preferences.source === "library" ? "Best Match from the Library" : "Best Match for Tonight",
    criteriaTitle: "Based on",
    assistantLabel: "ReelBot’s take",
    scoreLabel: "How close this feels",
    whyTitle: "Why this works",
    criteria,
    confidenceScore,
    confidenceLabel: getConfidenceLabel(confidenceScore),
    whyRecommended: whyRecommended.slice(0, 4),
  };
};
