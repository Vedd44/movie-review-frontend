export const COLLECTIONS = [
  {
    slug: "best-90s-action-movies",
    title: "Best 90s Action Movies",
    eyebrow: "ReelBot Collection",
    description: "The decade of practical stunts, movie stars and gloriously simple premises. Fifteen 90s action movies that still deliver.",
    prompt: "Give me a great 90s action movie",
    movies: ["terminator-2-judgment-day-1991","speed-1994","the-matrix-1999","the-rock-1996","face-off-1997","point-break-1991","true-lies-1994","con-air-1997","mission-impossible-1996","goldeneye-1995","the-long-kiss-goodnight-1996","air-force-one-1997","enemy-of-the-state-1998","executive-decision-1996","demolition-man-1993"],
  },
  {
    slug: "movies-like-heat",
    title: "Movies Like Heat",
    eyebrow: "If you liked Heat",
    description: "Professional criminals, obsessive cops and cities after dark. Fifteen crime thrillers that hit the same tense, grown-up register as Heat.",
    prompt: "Something like Heat",
    anchorMovie: "heat-1995",
    movies: ["thief-1981","collateral-2004","the-town-2010","inside-man-2006","ronin-1998","den-of-thieves-2018","training-day-2001","the-departed-2006","sicario-2015","drive-2011","to-live-and-die-in-la-1985","a-most-violent-year-2014","the-french-connection-1971","the-taking-of-pelham-one-two-three-1974","reservoir-dogs-1992"],
  },
  {
    slug: "movies-like-interstellar",
    title: "Movies Like Interstellar",
    eyebrow: "If you liked Interstellar",
    description: "Big science-fiction ideas with real emotional weight. Fifteen films about space, time, survival and the people caught in the middle.",
    prompt: "Something like Interstellar",
    anchorMovie: "interstellar-2014",
    movies: ["arrival-2016","contact-1997","the-martian-2015","2001-a-space-odyssey-1968","gravity-2013","sunshine-2007","ad-astra-2019","moon-2009","first-man-2018","solaris-2002","prospect-2018","aniara-2019","apollo-13-1995","high-life-2018","the-fountain-2006"],
  },
  {
    slug: "great-thrillers-under-2-hours",
    title: "Great Thrillers Under 2 Hours",
    eyebrow: "Shorter watches",
    description: "Tense, sharp and done before the two-hour mark. Fifteen thrillers that make every minute count.",
    prompt: "A great thriller under two hours",
    movies: ["run-lola-run-1998","phone-booth-2002","red-eye-2005","source-code-2011","a-simple-plan-1998","calibre-2018","the-guilty-2018","blue-ruin-2014","cop-car-2015","the-invitation-2015","green-room-2016","breakdown-1997","identity-2003","the-gift-2015","unsane-2018"],
  },
  {
    slug: "smart-sci-fi-movies",
    title: "Smart Sci-Fi Movies",
    eyebrow: "Ideas first",
    description: "Big ideas without the homework. Fifteen smart sci-fi movies that pair ambitious concepts with genuinely good filmmaking.",
    prompt: "Smart sci-fi with a real payoff",
    movies: ["arrival-2016","ex-machina-2015","children-of-men-2006","moon-2009","primer-2004","coherence-2013","annihilation-2018","minority-report-2002","district-9-2009","gattaca-1997","predestination-2014","upgrade-2018","her-2013","source-code-2011","the-endless-2017"],
  },
  {
    slug: "great-90-minute-movies",
    title: "Great 90-Minute Movies",
    eyebrow: "No three-hour commitment",
    description: "Short, sharp and satisfying. Fifteen great movies that land around the 90-minute mark without feeling slight.",
    prompt: "A great movie around 90 minutes",
    movies: ["before-sunset-2004","run-lola-run-1998","toy-story-1995","the-iron-giant-1999","what-we-do-in-the-shadows-2014","frances-ha-2013","stand-by-me-1986","zombieland-2009","cloverfield-2008","phone-booth-2002","palm-springs-2020","the-guilty-2018","perfect-blue-1998","attack-the-block-2011","the-lion-king-1994"],
  },
  {
    slug: "dark-crime-thrillers",
    title: "Dark Crime Thrillers",
    eyebrow: "After dark",
    description: "Bad decisions, moral gray zones and pressure that keeps tightening. Fifteen crime thrillers willing to get a little uncomfortable.",
    prompt: "A dark crime thriller",
    movies: ["prisoners-2013","zodiac-2007","sicario-2015","no-country-for-old-men-2007","nightcrawler-2014","blue-ruin-2014","a-history-of-violence-2005","gone-baby-gone-2007","the-girl-with-the-dragon-tattoo-2011","wind-river-2017","memories-of-murder-2003","before-the-devil-knows-youre-dead-2007","good-time-2017","the-drop-2014","animal-kingdom-2010"],
  },
  {
    slug: "comfort-movies-that-arent-rom-coms",
    title: "Comfort Movies That Aren't Rom-Coms",
    eyebrow: "Easy night",
    description: "Warm, rewatchable and easy to settle into, without defaulting to a rom-com. Fifteen movies built for a low-stakes watch.",
    prompt: "A comfort movie that isn't a rom-com",
    movies: ["chef-2014","the-martian-2015","school-of-rock-2003","paddington-2-2017","hunt-for-the-wilderpeople-2016","the-secret-life-of-walter-mitty-2013","o-brother-where-art-thou-2000","fantastic-mr-fox-2009","sing-street-2016","the-peanut-butter-falcon-2019","eddie-the-eagle-2016","the-princess-bride-1987","the-straight-story-1999","kikis-delivery-service-1989","the-muppets-2011"],
  },
  {
    slug: "best-movies-under-90-minutes", title: "Best Movies Under 90 Minutes", eyebrow: "Short watches",
    description: "Great movies, minimal commitment. Fifteen sharp, satisfying picks that get in and get out in under 90 minutes.",
    prompt: "Give me a great movie under 90 minutes", categories: ["Mood", "Occasion"],
    movies: ["run-lola-run-1998","toy-story-1995","before-sunset-2004","the-iron-giant-1999","what-we-do-in-the-shadows-2014","frances-ha-2013","stand-by-me-1986","phone-booth-2002","cloverfield-2008","palm-springs-2020","perfect-blue-1998","attack-the-block-2011","the-lion-king-1994","rec-2007","host-2020"],
  },
  {
    slug: "movies-when-you-dont-know-what-to-watch", title: "Movies to Watch When You Don’t Know What to Watch", eyebrow: "Decision solved",
    description: "Reliable, broadly loved movies for nights when every option somehow looks wrong.", prompt: "I have no idea what to watch", categories: ["Mood", "Occasion"],
    movies: ["the-prestige-2006","knives-out-2019","the-martian-2015","catch-me-if-you-can-2002","edge-of-tomorrow-2014","oceans-eleven-2001","the-social-network-2010","moneyball-2011","the-nice-guys-2016","school-of-rock-2003","parasite-2019","ford-v-ferrari-2019","the-truman-show-1998","jurassic-park-1993","the-fugitive-1993"],
  },
  {
    slug: "best-feel-good-movies", title: "Best Feel-Good Movies", eyebrow: "Good mood", description: "Warm, funny and genuinely uplifting without turning into wallpaper.", prompt: "Give me a feel-good movie", categories: ["Mood"],
    movies: ["paddington-2-2017","chef-2014","sing-street-2016","school-of-rock-2003","little-miss-sunshine-2006","the-princess-bride-1987","hunt-for-the-wilderpeople-2016","eddie-the-eagle-2016","brittany-runs-a-marathon-2019","the-peanut-butter-falcon-2019","about-time-2013","kikis-delivery-service-1989","the-muppets-2011","cool-runnings-1993","mrs-harris-goes-to-paris-2022"],
  },
  {
    slug: "best-comfort-movies", title: "Best Comfort Movies", eyebrow: "Easy night", description: "Familiar, warm and endlessly rewatchable. Movies that make staying in feel like the plan.", prompt: "Give me a comfort movie", categories: ["Mood"],
    movies: ["chef-2014","the-princess-bride-1987","school-of-rock-2003","fantastic-mr-fox-2009","o-brother-where-art-thou-2000","the-secret-life-of-walter-mitty-2013","paddington-2-2017","the-martian-2015","youve-got-mail-1998","groundhog-day-1993","a-league-of-their-own-1992","kikis-delivery-service-1989","sing-street-2016","the-muppets-2011","hunt-for-the-wilderpeople-2016"],
  },
  {
    slug: "best-date-night-movies", title: "Best Date Night Movies", eyebrow: "Watch together", description: "Funny, romantic, tense or just very watchable. Picks that give both of you something to enjoy.", prompt: "Give me a great date night movie", categories: ["Occasion"],
    movies: ["palm-springs-2020","crazy-stupid-love-2011","about-time-2013","the-big-sick-2017","game-night-2018","knives-out-2019","before-sunrise-1995","out-of-sight-1998","the-nice-guys-2016","la-la-land-2016","silver-linings-playbook-2012","the-thomas-crown-affair-1999","midnight-in-paris-2011","when-harry-met-sally-1989","eternal-sunshine-of-the-spotless-mind-2004"],
  },
  {
    slug: "best-movies-to-watch-with-friends", title: "Best Movies to Watch With Friends", eyebrow: "Crowd pleasers", description: "Big laughs, big reactions and enough momentum to survive a room full of distractions.", prompt: "A great movie to watch with friends", categories: ["Occasion"],
    movies: ["game-night-2018","superbad-2007","the-hangover-2009","hot-fuzz-2007","21-jump-street-2012","top-gun-maverick-2022","mad-max-fury-road-2015","knives-out-2019","zombieland-2009","the-cabin-in-the-woods-2012","oceans-eleven-2001","tropic-thunder-2008","bridesmaids-2011","the-nice-guys-2016","scott-pilgrim-vs-the-world-2010"],
  },
  {
    slug: "best-sunday-night-movies", title: "Best Movies for a Sunday Night", eyebrow: "Sunday reset", description: "Engaging without being exhausting. The sweet spot between comfort watch and actually good movie.", prompt: "A good Sunday night movie", categories: ["Mood", "Occasion"],
    movies: ["moneyball-2011","chef-2014","the-martian-2015","spotlight-2015","ford-v-ferrari-2019","the-intern-2015","air-2023","the-secret-life-of-walter-mitty-2013","julie-and-julia-2009","the-terminal-2004","eddie-the-eagle-2016","the-fugitive-1993","a-league-of-their-own-1992","the-straight-story-1999","hunt-for-the-wilderpeople-2016"],
  },
  {
    slug: "best-friday-night-movies", title: "Best Movies for a Friday Night", eyebrow: "Weekend starts here", description: "Fast, fun and worth turning the volume up for. Movies that feel like Friday night.", prompt: "A great Friday night movie", categories: ["Mood", "Occasion"],
    movies: ["top-gun-maverick-2022","mad-max-fury-road-2015","the-rock-1996","oceans-eleven-2001","mission-impossible-fallout-2018","game-night-2018","edge-of-tomorrow-2014","the-nice-guys-2016","john-wick-2014","speed-1994","hot-fuzz-2007","casino-royale-2006","bullet-train-2022","the-mummy-1999","con-air-1997"],
  },
  {
    slug: "movies-that-hook-you-immediately", title: "Movies That Hook You Immediately", eyebrow: "No slow starts", description: "No waiting an hour for it to get good. Fifteen movies that grab you early and keep moving.", prompt: "A movie that hooks me immediately", categories: ["Mood"],
    movies: ["the-dark-knight-2008","mad-max-fury-road-2015","the-social-network-2010","scream-1996","baby-driver-2017","goodfellas-1990","the-matrix-1999","inglourious-basterds-2009","whiplash-2014","speed-1994","casino-royale-2006","28-days-later-2002","source-code-2011","train-to-busan-2016","the-fugitive-1993"],
  },
  {
    slug: "best-edge-of-your-seat-thrillers", title: "Best Edge-of-Your-Seat Thrillers", eyebrow: "Tension dialed up", description: "Pressure, momentum and very few reasons to check your phone.", prompt: "Give me an edge-of-your-seat thriller", categories: ["Genre", "Mood"],
    movies: ["prisoners-2013","sicario-2015","green-room-2016","calibre-2018","the-guilty-2018","uncut-gems-2019","a-quiet-place-2018","dont-breathe-2016","breakdown-1997","red-eye-2005","the-invitation-2015","run-2020","captain-phillips-2013","the-next-three-days-2010","inside-man-2006"],
  },
  {
    slug: "best-psychological-thrillers", title: "Best Psychological Thrillers", eyebrow: "Inside your head", description: "Unreliable memories, dangerous obsessions and the creeping sense that something is very wrong.", prompt: "A great psychological thriller", categories: ["Genre"],
    movies: ["gone-girl-2014","shutter-island-2010","black-swan-2010","the-game-1997","memento-2000","the-gift-2015","enemy-2013","side-effects-2013","the-machinist-2004","frailty-2001","insomnia-2002","take-shelter-2011","jacobs-ladder-1990","the-talented-mr-ripley-1999","cape-fear-1991"],
  },
  {
    slug: "best-mind-bending-movies", title: "Best Mind-Bending Movies", eyebrow: "Reality optional", description: "Time loops, fractured realities and movies you'll still be unpacking tomorrow.", prompt: "Give me a mind-bending movie", categories: ["Mood", "Genre"],
    movies: ["inception-2010","coherence-2013","primer-2004","predestination-2014","memento-2000","enemy-2013","donnie-darko-2001","triangle-2009","the-prestige-2006","mulholland-drive-2001","source-code-2011","the-endless-2017","timecrimes-2007","upstream-color-2013","eternal-sunshine-of-the-spotless-mind-2004"],
  },
  {
    slug: "best-sci-fi-movies", title: "Best Sci-Fi Movies", eyebrow: "Essential sci-fi", description: "Big ideas, unforgettable worlds and science fiction that earns the hype.", prompt: "Give me one of the best sci-fi movies", categories: ["Genre"],
    movies: ["2001-a-space-odyssey-1968","alien-1979","blade-runner-1982","the-matrix-1999","children-of-men-2006","arrival-2016","interstellar-2014","ex-machina-2015","district-9-2009","terminator-2-judgment-day-1991","the-thing-1982","minority-report-2002","moon-2009","edge-of-tomorrow-2014","contact-1997"],
  },
  {
    slug: "best-horror-movies", title: "Best Horror Movies", eyebrow: "Essential horror", description: "The classics, the modern standouts and the movies that still know exactly how to get under your skin.", prompt: "Give me one of the best horror movies", categories: ["Genre"],
    movies: ["the-exorcist-1973","the-shining-1980","the-thing-1982","alien-1979","scream-1996","the-witch-2015","hereditary-2018","get-out-2017","the-babadook-2014","the-conjuring-2013","it-follows-2014","28-days-later-2002","the-cabin-in-the-woods-2012","train-to-busan-2016","the-descent-2005"],
  },
  {
    slug: "best-comedy-movies", title: "Best Comedy Movies", eyebrow: "Actually funny", description: "Comedies worth rewatching, quoting and recommending without an apology.", prompt: "Give me a genuinely funny movie", categories: ["Genre"],
    movies: ["airplane-1980","groundhog-day-1993","the-big-lebowski-1998","superbad-2007","hot-fuzz-2007","bridesmaids-2011","what-we-do-in-the-shadows-2014","the-nice-guys-2016","game-night-2018","best-in-show-2000","office-space-1999","tropic-thunder-2008","walk-hard-the-dewey-cox-story-2007","booksmart-2019","my-cousin-vinny-1992"],
  },
  {
    slug: "best-movies-of-the-1980s", title: "Best Movies of the 1980s", eyebrow: "The 1980s", description: "Blockbusters, cult classics and genuinely great filmmaking from a decade that knew how to entertain.", prompt: "Give me a great movie from the 1980s", categories: ["Era"],
    movies: ["raiders-of-the-lost-ark-1981","the-thing-1982","blade-runner-1982","back-to-the-future-1985","aliens-1986","die-hard-1988","the-princess-bride-1987","robocop-1987","the-terminator-1984","stand-by-me-1986","do-the-right-thing-1989","when-harry-met-sally-1989","the-shining-1980","amadeus-1984","after-hours-1985"],
  },
  {
    slug: "best-movies-of-the-1990s", title: "Best Movies of the 1990s", eyebrow: "The 1990s", description: "Movie stars, mid-budget classics and a ridiculous run of films people still watch today.", prompt: "Give me a great movie from the 1990s", categories: ["Era"],
    movies: ["goodfellas-1990","the-silence-of-the-lambs-1991","jurassic-park-1993","pulp-fiction-1994","heat-1995","fargo-1996","la-confidential-1997","the-truman-show-1998","the-matrix-1999","the-fugitive-1993","se7en-1995","scream-1996","boogie-nights-1997","the-big-lebowski-1998","fight-club-1999"],
  },
  {
    slug: "best-movies-of-the-2000s", title: "Best Movies of the 2000s", eyebrow: "The 2000s", description: "Prestige filmmaking, huge genre movies and modern classics from an unusually deep decade.", prompt: "Give me a great movie from the 2000s", categories: ["Era"],
    movies: ["gladiator-2000","memento-2000","the-lord-of-the-rings-the-fellowship-of-the-ring-2001","city-of-god-2002","lost-in-translation-2003","eternal-sunshine-of-the-spotless-mind-2004","batman-begins-2005","the-prestige-2006","no-country-for-old-men-2007","the-dark-knight-2008","inglourious-basterds-2009","children-of-men-2006","zodiac-2007","there-will-be-blood-2007","the-departed-2006"],
  },
  {
    slug: "best-hidden-gem-movies", title: "Best Hidden Gem Movies", eyebrow: "Worth discovering", description: "Excellent movies that deserve more attention than they get. Less obvious, never second-rate.", prompt: "Give me a hidden gem movie", categories: ["Mood"],
    movies: ["blue-ruin-2014","the-drop-2014","calibre-2018","the-kid-detective-2020","cop-car-2015","prospect-2018","the-one-i-love-2014","thoroughbreds-2018","a-dark-song-2016","the-clovehitch-killer-2018","faults-2014","the-vast-of-night-2020","the-art-of-self-defense-2019","cold-in-july-2014","the-guilty-2018"],
  },
  {
    slug: "movies-everyone-should-see-once", title: "Movies Everyone Should See Once", eyebrow: "Start here", description: "Not homework. Just landmark movies with enough craft, influence or pure entertainment value to justify the reputation.", prompt: "Give me a movie everyone should see once", categories: ["Mood", "Era"],
    movies: ["the-godfather-1972","jaws-1975","star-wars-1977","raiders-of-the-lost-ark-1981","back-to-the-future-1985","goodfellas-1990","the-silence-of-the-lambs-1991","jurassic-park-1993","pulp-fiction-1994","the-matrix-1999","the-lord-of-the-rings-the-fellowship-of-the-ring-2001","the-dark-knight-2008","parasite-2019","mad-max-fury-road-2015","spirited-away-2001"],
  },

  {
    slug: "best-halloween-movies", title: "Best Halloween Movies", eyebrow: "Halloween season",
    description: "Pumpkin-lit streets, ghosts, witches and just enough menace. Twenty movies that actually feel like Halloween.",
    prompt: "Give me a great Halloween movie", categories: ["Seasonal", "Occasion"],
    movies: ["halloween-1978","trick-r-treat-2007","hocus-pocus-1993","beetlejuice-1988","the-nightmare-before-christmas-1993","scream-1996","the-addams-family-1991","sleepy-hollow-1999","casper-1995","monster-house-2006","coraline-2009","the-craft-1996","practical-magic-1998","paranorman-2012","the-lost-boys-1987","the-witches-1990","edward-scissorhands-1990","ghostbusters-1984","the-crow-1994","donnie-darko-2001"],
  },
  {
    slug: "scariest-movies", title: "Scariest Movies Ever", eyebrow: "Lights on",
    description: "Dread, shocks and images that stick around after the credits. Twenty horror movies built to genuinely scare you.",
    prompt: "Give me something genuinely scary", categories: ["Seasonal", "Genre", "Mood"],
    movies: ["the-exorcist-1973","hereditary-2018","the-ring-2002","the-conjuring-2013","the-blair-witch-project-1999","the-shining-1980","the-witch-2015","the-grudge-2004","the-babadook-2014","the-descent-2005","sinister-2012","the-texas-chain-saw-massacre-1974","the-autopsy-of-jane-doe-2016","the-dark-and-the-wicked-2020","the-strangers-2008","the-wailing-2016","it-follows-2014","the-others-2001","the-omen-1976","rec-2007"],
  },
  {
    slug: "goriest-horror-movies", title: "Goriest Horror Movies", eyebrow: "Not for the squeamish",
    description: "Practical effects, body horror and absolutely no interest in looking away. Twenty horror movies for when subtle is not the assignment.",
    prompt: "Give me a seriously gory horror movie", categories: ["Seasonal", "Genre"],
    movies: ["the-substance-2024","evil-dead-2013","evil-dead-rise-2023","braindead-1992","the-fly-1986","the-thing-1982","terrifier-2-2022","terrifier-3-2024","saw-2004","hostel-2005","the-sadness-2021","bone-tomahawk-2015","green-room-2016","when-evil-lurks-2023","hellraiser-1987","re-animator-1985","day-of-the-dead-1985","the-hills-have-eyes-2006","inside-2007","tokyo-gore-police-2008"],
  },
  {
    slug: "best-slasher-movies", title: "Best Slasher Movies", eyebrow: "Sharp objects",
    description: "Final girls, masked killers and genre rules made to be broken. Twenty slashers worth surviving.",
    prompt: "Give me a great slasher movie", categories: ["Seasonal", "Genre"],
    movies: ["halloween-1978","psycho-1960","black-christmas-1974","the-texas-chain-saw-massacre-1974","scream-1996","a-nightmare-on-elm-street-1984","friday-the-13th-1980","childs-play-1988","candyman-1992","youre-next-2011","the-strangers-2008","x-2022","pearl-2022","happy-death-day-2017","the-burning-1981","sleepaway-camp-1983","my-bloody-valentine-1981","the-town-that-dreaded-sundown-1976","the-final-girls-2015","freaky-2020"],
  },
  {
    slug: "family-halloween-movies", title: "Family-Friendly Halloween Movies", eyebrow: "Spooky, not terrifying",
    description: "Ghosts, monsters and Halloween atmosphere without turning movie night into a nightmare. Twenty family-friendly seasonal picks.",
    prompt: "Give me a family-friendly Halloween movie", categories: ["Seasonal", "Occasion"],
    movies: ["hocus-pocus-1993","casper-1995","the-addams-family-1991","addams-family-values-1993","hotel-transylvania-2012","paranorman-2012","frankenweenie-2012","monster-house-2006","coraline-2009","the-nightmare-before-christmas-1993","halloweentown-1998","the-witches-1990","scooby-doo-2002","ghostbusters-1984","haunted-mansion-2023","goosebumps-2015","wallace-gromit-the-curse-of-the-were-rabbit-2005","corpse-bride-2005","the-little-vampire-2000","ernest-scared-stupid-1991"],
  },
  {
    slug: "cozy-fall-movies", title: "Cozy Fall Movies", eyebrow: "Autumn watchlist",
    description: "Crisp air, warm kitchens, changing leaves and movies made for staying in. Twenty films with peak fall atmosphere.",
    prompt: "Give me a cozy fall movie", categories: ["Seasonal", "Mood"],
    movies: ["when-harry-met-sally-1989","youve-got-mail-1998","good-will-hunting-1997","dead-poets-society-1989","fantastic-mr-fox-2009","knives-out-2019","practical-magic-1998","little-women-2019","october-sky-1999","rushmore-1998","mona-lisa-smile-2003","the-royal-tenenbaums-2001","mystic-pizza-1988","remember-the-titans-2000","rudy-1993","the-village-2004","planes-trains-and-automobiles-1987","dan-in-real-life-2007","silver-linings-playbook-2012","harry-potter-and-the-prisoner-of-azkaban-2004"],
  },
  {
    slug: "best-christmas-movies", title: "Best Christmas Movies", eyebrow: "Christmas classics",
    description: "Warm, funny, nostalgic and occasionally chaotic. Twenty Christmas movies worth making part of the tradition.",
    prompt: "Give me a great Christmas movie", categories: ["Seasonal", "Occasion"],
    movies: ["its-a-wonderful-life-1946","home-alone-1990","elf-2003","the-muppet-christmas-carol-1992","national-lampoons-christmas-vacation-1989","miracle-on-34th-street-1947","the-santa-clause-1994","klaus-2019","a-christmas-story-1983","love-actually-2003","the-holiday-2006","scrooged-1988","white-christmas-1954","arthur-christmas-2011","the-polar-express-2004","bad-santa-2003","the-holdovers-2023","gremlins-1984","die-hard-1988","the-nightmare-before-christmas-1993"],
  },
  {
    slug: "family-christmas-movies", title: "Family Christmas Movies", eyebrow: "Christmas together",
    description: "Big-hearted, funny and festive. Twenty Christmas movies that work for a family movie night.",
    prompt: "Give me a family Christmas movie", categories: ["Seasonal", "Occasion"],
    movies: ["home-alone-1990","elf-2003","klaus-2019","the-muppet-christmas-carol-1992","arthur-christmas-2011","the-santa-clause-1994","the-polar-express-2004","miracle-on-34th-street-1947","the-grinch-2018","how-the-grinch-stole-christmas-2000","jingle-all-the-way-1996","a-christmas-story-1983","the-christmas-chronicles-2018","noelle-2019","mickeys-christmas-carol-1983","prancer-1989","the-snowman-1982","nativity-2009","the-nightmare-before-christmas-1993","the-star-2017"],
  },
  {
    slug: "christmas-movies-for-adults", title: "Christmas Movies for Adults", eyebrow: "After the kids go to bed",
    description: "Romance, cynicism, crime and holiday dysfunction. Twenty Christmas movies that skew decidedly grown-up.",
    prompt: "Give me a Christmas movie for adults", categories: ["Seasonal", "Occasion"],
    movies: ["the-holdovers-2023","the-holiday-2006","love-actually-2003","bad-santa-2003","the-family-stone-2005","carol-2015","the-night-before-2015","scrooged-1988","trading-places-1983","the-apartment-1960","kiss-kiss-bang-bang-2005","die-hard-1988","the-ref-1994","eyes-wide-shut-1999","tangerine-2015","happiest-season-2020","the-best-man-holiday-2013","office-christmas-party-2016","the-ice-harvest-2005","just-friends-2005"],
  },
  {
    slug: "christmas-horror-movies", title: "Christmas Horror Movies", eyebrow: "Season's screamings",
    description: "Killer Santas, winter monsters and festive cheer gone very wrong. Twenty horror movies for a darker Christmas.",
    prompt: "Give me a Christmas horror movie", categories: ["Seasonal", "Genre"],
    movies: ["black-christmas-1974","gremlins-1984","krampus-2015","rare-exports-a-christmas-tale-2010","better-watch-out-2016","terrifier-3-2024","silent-night-deadly-night-1984","christmas-evil-1980","anna-and-the-apocalypse-2018","a-christmas-horror-story-2015","dead-end-2003","the-advent-calendar-2021","the-children-2008","p2-2007","christmas-bloody-christmas-2022","the-lodge-2019","jack-frost-1997","deadly-games-1989","the-nightmare-before-christmas-1993","the-day-of-the-beast-1995"],
  },
  {
    slug: "best-winter-movies", title: "Best Winter Movies", eyebrow: "Cold outside",
    description: "Snowbound thrillers, frozen landscapes and cozy escapes. Twenty movies that make winter part of the story.",
    prompt: "Give me a great winter movie", categories: ["Seasonal", "Mood"],
    movies: ["the-thing-1982","fargo-1996","the-shining-1980","the-revenant-2015","misery-1990","the-hateful-eight-2015","wind-river-2017","the-holdovers-2023","snowpiercer-2013","the-grey-2012","doctor-zhivago-1965","groundhog-day-1993","let-the-right-one-in-2008","inside-llewyn-davis-2013","the-grand-budapest-hotel-2014","the-girl-with-the-dragon-tattoo-2011","a-simple-plan-1998","frozen-2013","the-ice-storm-1997","little-women-2019"],
  },

];

export const COLLECTION_CATEGORIES = ["All", "Seasonal", "Mood", "Genre", "Era", "Occasion"];

export const getCollection = (slug) => COLLECTIONS.find((collection) => collection.slug === slug);
