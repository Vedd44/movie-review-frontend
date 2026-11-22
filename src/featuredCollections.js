// Reviewed editorial campaigns, bounded to specific dates in America/New_York.
// Explicit offsets avoid dependence on the browser/server timezone or annual recurrence.
const OCTOBER_START = Date.parse("2026-10-01T00:00:00-04:00");
const OCTOBER_END = Date.parse("2026-11-01T00:00:00-04:00");
const CHRISTMAS_START = Date.parse("2026-12-01T00:00:00-05:00");
const CHRISTMAS_END = Date.parse("2027-01-01T00:00:00-05:00");
const FEATURED_BOUNDARIES = [OCTOBER_START, OCTOBER_END, CHRISTMAS_START, CHRISTMAS_END];
// Reviewed November handoff: three distinct viewing needs from the existing catalog.
const EVERGREEN_SLUGS = ["best-feel-good-movies", "great-thrillers-under-2-hours", "animated-movies-for-adults"];
const OCTOBER_SLUGS = ["haunted-house-ghost-stories", "best-halloween-movies", "cozy-fall-movies"];
const CHRISTMAS_SLUGS = ["best-christmas-movies", "family-christmas-movies", "christmas-movies-for-adults"];
const CHRISTMAS_NOTES = {
  "best-christmas-movies": "Holiday classics worth making part of the tradition.",
  "family-christmas-movies": "Big-hearted picks for a family movie night.",
  "christmas-movies-for-adults": "Romance, comedy and a little holiday dysfunction.",
};
const OCTOBER_NOTES = {
  "haunted-house-ghost-stories": "Eight haunted-house favourites, from quiet chills to full-on scares.",
  "best-halloween-movies": "From playful favourites to full-on horror.",
  "cozy-fall-movies": "Autumn atmosphere, from warm comedies to moodier stories.",
};

function getFeaturedCollections(collections, now = Date.now(), mode = "seasonal") {
  const time = Number(now);
  const isOctober = mode !== "evergreen" && time >= OCTOBER_START && time < OCTOBER_END;
  const isChristmas = mode !== "evergreen" && time >= CHRISTMAS_START && time < CHRISTMAS_END;
  const slugs = isOctober ? OCTOBER_SLUGS : isChristmas ? CHRISTMAS_SLUGS : EVERGREEN_SLUGS;
  return {
    isOctober,
    heading: isOctober ? "Oh, the Horror!" : isChristmas ? "Christmas movie night" : "Explore our collections",
    description: isOctober
      ? "Haunted houses, Halloween favourites and autumn atmosphere. Find your kind of night."
      : isChristmas
        ? "Holiday classics, family favorites and something for after the kids go to bed."
        : "A few useful places to start when you know the kind of movie you want.",
    collections: slugs.map((slug) => collections.find((collection) => collection.slug === slug)).filter(Boolean),
    notes: isOctober ? OCTOBER_NOTES : isChristmas ? CHRISTMAS_NOTES : {},
  };
}

function getNextFeaturedBoundary(now = Date.now()) {
  const time = Number(now);
  return FEATURED_BOUNDARIES.find(boundary => boundary > time) ?? null;
}

module.exports = { getFeaturedCollections, getNextFeaturedBoundary, OCTOBER_START, OCTOBER_END, CHRISTMAS_START, CHRISTMAS_END };
