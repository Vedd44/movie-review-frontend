export const REELBOT_LOADING_QUOTES = Object.freeze([
  { quote: "Here’s looking at you, kid.", movie: "Casablanca" },
  { quote: "There’s no place like home.", movie: "The Wizard of Oz" },
  { quote: "May the Force be with you.", movie: "Star Wars" },
  { quote: "To infinity and beyond!", movie: "Toy Story" },
  { quote: "Just keep swimming.", movie: "Finding Nemo" },
  { quote: "Nobody puts Baby in a corner.", movie: "Dirty Dancing" },
  { quote: "Carpe diem. Seize the day, boys.", movie: "Dead Poets Society" },
  { quote: "Roads? Where we’re going, we don’t need roads.", movie: "Back to the Future" },
  { quote: "I’ll be back.", movie: "The Terminator" },
  { quote: "You’re gonna need a bigger boat.", movie: "Jaws" },
  { quote: "E.T. phone home.", movie: "E.T." },
  { quote: "I see dead people.", movie: "The Sixth Sense" },
  { quote: "Why so serious?", movie: "The Dark Knight" },
  { quote: "I am your father.", movie: "The Empire Strikes Back" },
  { quote: "Wax on, wax off.", movie: "The Karate Kid" },
  { quote: "As if!", movie: "Clueless" },
  { quote: "You talking to me?", movie: "Taxi Driver" },
  { quote: "Show me the money!", movie: "Jerry Maguire" },
  { quote: "I feel the need—the need for speed!", movie: "Top Gun" },
  { quote: "Hasta la vista, baby.", movie: "Terminator 2" },
  { quote: "Keep your friends close, but your enemies closer.", movie: "The Godfather Part II" },
  { quote: "…but they'll never take our freedom!", movie: "Braveheart" },
  { quote: "I’m the king of the world!", movie: "Titanic" },
  { quote: "You can’t handle the truth!", movie: "A Few Good Men" },
  { quote: "Houston, we have a problem.", movie: "Apollo 13" },
  { quote: "There’s no crying in baseball!", movie: "A League of Their Own" },
  { quote: "I’m having an old friend for dinner.", movie: "The Silence of the Lambs" },
  { quote: "Get away from her, you bitch!", movie: "Aliens" },
  { quote: "The Dude abides.", movie: "The Big Lebowski" },
  { quote: "That’ll do, pig. That’ll do.", movie: "Babe" },
]);

export const pickLoadingQuote = (random = Math.random) => {
  const index = Math.floor(random() * REELBOT_LOADING_QUOTES.length);
  return REELBOT_LOADING_QUOTES[Math.max(0, Math.min(index, REELBOT_LOADING_QUOTES.length - 1))];
};
