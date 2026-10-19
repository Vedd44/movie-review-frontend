// One reviewed editorial campaign, bounded to October 2026 in America/New_York.
// Explicit offsets avoid dependence on the browser/server timezone or annual recurrence.
const OCTOBER_START = Date.parse("2026-10-01T00:00:00-04:00");
const OCTOBER_END = Date.parse("2026-11-01T00:00:00-04:00");
const EVERGREEN_SLUGS = ["best-90s-action-movies", "movies-like-heat", "movies-like-interstellar"];
const OCTOBER_SLUGS = ["haunted-house-ghost-stories", "best-halloween-movies", "cozy-fall-movies"];
const OCTOBER_NOTES = {
  "haunted-house-ghost-stories": "Eight haunted-house favourites, from quiet chills to full-on scares.",
  "best-halloween-movies": "From playful favourites to full-on horror.",
  "cozy-fall-movies": "Autumn atmosphere, from warm comedies to moodier stories.",
};

function getFeaturedCollections(collections, now = Date.now(), mode = "seasonal") {
  const time = Number(now);
  const isOctober = mode !== "evergreen" && time >= OCTOBER_START && time < OCTOBER_END;
  const slugs = isOctober ? OCTOBER_SLUGS : EVERGREEN_SLUGS;
  return {
    isOctober,
    heading: isOctober ? "Oh, the Horror!" : "Explore our latest collections",
    description: isOctober
      ? "Haunted houses, Halloween favourites and autumn atmosphere. Find your kind of night."
      : "A few useful places to start when you know the kind of movie you want.",
    collections: slugs.map((slug) => collections.find((collection) => collection.slug === slug)).filter(Boolean),
    notes: isOctober ? OCTOBER_NOTES : {},
  };
}

function getNextFeaturedBoundary(now = Date.now()) {
  const time = Number(now);
  return time < OCTOBER_START ? OCTOBER_START : time < OCTOBER_END ? OCTOBER_END : null;
}

module.exports = { getFeaturedCollections, getNextFeaturedBoundary, OCTOBER_START, OCTOBER_END };
