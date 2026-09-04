export const REELBOT_LOADING_QUOTES = Object.freeze([
  { quote: "Here’s looking at you, kid.", movie: "Casablanca" },
  { quote: "There’s no place like home.", movie: "The Wizard of Oz" },
  { quote: "May the Force be with you.", movie: "Star Wars" },
  { quote: "To infinity and beyond!", movie: "Toy Story" },
  { quote: "Just keep swimming.", movie: "Finding Nemo" },
  { quote: "Nobody puts Baby in a corner.", movie: "Dirty Dancing" },
  { quote: "Carpe diem. Seize the day, boys.", movie: "Dead Poets Society" },
  { quote: "Roads? Where we’re going, we don’t need roads.", movie: "Back to the Future" },
]);

export const pickLoadingQuote = (random = Math.random) => {
  const index = Math.floor(random() * REELBOT_LOADING_QUOTES.length);
  return REELBOT_LOADING_QUOTES[Math.max(0, Math.min(index, REELBOT_LOADING_QUOTES.length - 1))];
};
