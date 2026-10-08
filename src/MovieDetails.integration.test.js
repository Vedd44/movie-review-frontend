import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import axios from "axios";
import MovieDetails from "./MovieDetails";
import useTasteProfile from "./hooks/useTasteProfile";
import { fetchWatchmodeAvailability } from "./services/watchmodeService";

jest.mock("axios");
jest.mock("./services/watchmodeService");
jest.mock("./hooks/useTasteProfile");

const movie = {
  id: 679,
  title: "Aliens",
  description: "Ripley returns to face the alien threat.",
  release_date: "1986-07-18",
  release_year: 1986,
  runtime: 137,
  status: "Released",
  director: "James Cameron",
  director_credit: { id: 2710, name: "James Cameron", profile_path: "/james.jpg" },
  top_cast: ["Sigourney Weaver"],
  top_cast_credits: [{ id: 10205, name: "Sigourney Weaver", character: "Ripley", profile_path: null }],
  genre_names: ["Action", "Science Fiction"],
  content_signals: { peril: 0.82, scariness: 0.6, stimulation_level: 0.53, emotional_intensity: 0.48 },
  audience_signals: { kid_friendliness: 0, consensus_friendliness: 0.28 },
  rating: 8.0,
  poster_path: "/aliens.jpg",
  trailer: { key: "aliens-trailer", name: "Aliens trailer" },
  watch_providers: {
    region: "US",
    link: "https://www.themoviedb.org/movie/679-aliens/watch?locale=US",
    subscription: [{ id: 8, name: "Netflix", logo_path: "/netflix.jpg" }],
    rent: [],
    buy: [],
  },
  review_highlights: {},
  similar: [{ id: 2787, title: "Pitch Black", release_date: "2000-02-18", poster_path: "/pitch-black.jpg" }],
};

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;

const generatedTake = {
  assessment: "A pressure-cooker action film that keeps tactical competence and mounting dread in the same frame.",
  good_fit_if: "You want tense, muscular science fiction that rewards full attention.",
  maybe_not_if: "You need a calm, low-threat watch or something suitable for young children.",
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  fetchWatchmodeAvailability.mockResolvedValue(null);
  axios.get.mockImplementation((url) => Promise.resolve(
    String(url).includes("/reelbot-take") ? { data: { take: generatedTake } } : { data: movie }
  ));
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => null),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });
});

test("presents one contextual ReelBot entry point and factual watch providers", async () => {
  fetchWatchmodeAvailability.mockResolvedValue({
    source: 'watchmode', region: 'US',
    subscription: [{id: 203, name: 'Netflix', direct_url: 'https://www.netflix.com/title/123'}],
    rent: [], buy: [], free: [], cable: [],
  });
  const askListener = jest.fn();
  window.addEventListener("reelbot:open-ask", askListener);

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "ReelBot’s Take" })).toBeInTheDocument();
  expect(await screen.findByText(generatedTake.assessment)).toBeInTheDocument();
  expect(screen.queryByText("Decision help")).not.toBeInTheDocument();
  expect(screen.queryByText("Why ReelBot recommends this")).not.toBeInTheDocument();
  expect(screen.queryByText("Quick Take or deeper check?")).not.toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "Watch on Netflix" })).toHaveAttribute("href", "https://www.netflix.com/title/123");
  expect(screen.getByRole("link", {name: "Watchmode"})).toHaveAttribute("href", "https://www.watchmode.com/");
  expect(screen.getByRole("link", { name: /See all current viewing options/i })).toHaveAttribute("href", movie.watch_providers.link);

  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot about this movie/i }));
  expect(askListener).toHaveBeenCalled();
  window.removeEventListener("reelbot:open-ask", askListener);
});

test("groups movie hero actions in the intended order", async () => {
  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  const actionGroup = await screen.findByRole("group", { name: "Movie actions" });
  expect(actionGroup).toHaveClass("detail-hero-actions--simplified");
  expect(within(actionGroup).getAllByRole("button").map((button) => button.textContent.trim())).toEqual([
    "Where to Watch",
    "Save",
    "Cast & details",
    "Watch trailer",
  ]);
});

test("does not reuse historical recommendation context for a direct, search, or browse visit", async () => {
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => ({
      source: "reelbot_pick",
      prompt: "tense sci-fi",
      intent: { tone: ["tense"] },
    })),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "ReelBot’s Take" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Why ReelBot Picked This" })).not.toBeInTheDocument();
});

test("preserves active recommendation provenance alongside the movie-specific take", async () => {
  useTasteProfile.mockReturnValue({
    profile: { skipped: [] },
    actions: { addRecentMovie: jest.fn().mockResolvedValue(), recordDetailView: jest.fn().mockResolvedValue() },
    getRecommendationContextForMovie: jest.fn(() => ({
      source: "reelbot_pick",
      prompt: "tense sci-fi",
      intent: { tone: ["tense"] },
      rationale: {
        decisionSentence: "Aliens turns the requested tension into sustained siege pressure and propulsive action.",
        whyRecommended: ["Its escalating threat directly matches the tense science-fiction brief."],
      },
    })),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });

  render(
    <MemoryRouter initialEntries={[{
      pathname: "/movies/aliens-1986",
      state: { source: "reelbot_pick", recommendationVisit: { movieId: 679 } },
    }]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "ReelBot’s Take" })).toBeInTheDocument();
  expect(await screen.findByText(generatedTake.assessment)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/reelbot-take"), expect.objectContaining({ signal: expect.anything() }));
});

test("keeps the movie page available when Take generation fails", async () => {
  axios.get.mockImplementation((url) => String(url).includes("/reelbot-take")
    ? Promise.reject(new Error("take unavailable"))
    : Promise.resolve({ data: movie }));

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  expect(await screen.findByText((_, element) => element?.className === "detail-take-assessment" && /fuller viewing read for Aliens is temporarily unavailable/i.test(element.textContent))).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Where to Watch" })).toBeInTheDocument();
});

test("links cast and director to canonical people routes and handles missing headshots", async () => {
  window.scrollTo = jest.fn();
  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <Routes><Route path="/movies/:movieSlug" element={<MovieDetails />} /></Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Cast & Details" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /James Cameron/i })[0]).toHaveAttribute("href", "/people/james-cameron");
  expect(screen.getByRole("link", { name: /Sigourney Weaver/i })).toHaveAttribute("href", "/people/sigourney-weaver");
  fireEvent.click(screen.getByRole("button", { name: /Cast & details/i }));
  expect(window.scrollTo).toHaveBeenCalled();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/movies/resolve/aliens-1986"), expect.objectContaining({ signal: expect.anything() })));
});

test("legacy movie URLs canonicalize to title and year", async () => {
  render(
    <MemoryRouter initialEntries={["/movies/679/aliens"]}>
      <Routes>
        <Route path="/movies/:legacyMovieId/:legacySlug" element={<><MovieDetails /><LocationProbe /></>} />
        <Route path="/movies/:movieSlug" element={<><MovieDetails /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/movies/aliens-1986"));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/movies/679"), expect.objectContaining({ signal: expect.anything() }));
});

test("partial movie data keeps identity and Save without inventing availability", async () => {
  const title = "A Very Long Movie Title That Still Needs a Clear Identity and a Place to Save It";
  axios.get.mockImplementation((url) => Promise.resolve(String(url).includes('/reelbot-take') ? {data:{take:generatedTake}} : {data:{...movie,title,poster_path:null,watch_providers:null,description:'A short premise.',runtime:null,trailer:null}}));
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><Routes><Route path="/movies/:movieSlug" element={<MovieDetails/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:title})).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Artwork unavailable'})).toBeInTheDocument();
  expect(screen.getByText('Use TMDB to see current streaming, rental, and purchase options.')).toBeInTheDocument();
  expect(screen.getByRole('link',{name:/See all current viewing options/})).toHaveAttribute('href', 'https://www.themoviedb.org/movie/679/watch?locale=US');
  expect(screen.queryByRole('link',{name:/Watch on/})).not.toBeInTheDocument();
  expect(screen.getByText('Provider data from JustWatch via TMDB.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Save'})).toBeInTheDocument();
});

test.each([[404, 'Movie not found'], [503, 'Unable to load this movie']])('movie failure %i keeps the appropriate recovery state', async (status, title) => {
  axios.get.mockRejectedValue({response:{status}});
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><Routes><Route path="/movies/:movieSlug" element={<MovieDetails/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:title})).toBeInTheDocument();
  if (status === 503) expect(screen.getByRole('button',{name:'Try again'})).toBeInTheDocument();
});

 test("short shared pick puts the request and reason under the movie facts without redirecting", async () => {
  axios.get.mockImplementation((url) => Promise.resolve(
    String(url).includes("/reelbot/shares/") ? {data:{v:1,id:679,brief:"Tense science fiction for tonight",why:"*Aliens* fits the request with tactical tension."}} :
    String(url).includes("/reelbot-take") ? {data:{take:generatedTake}} : {data:movie}
  ));
  render(<MemoryRouter initialEntries={["/p/Abcdef123456"]}><Routes><Route path="/p/:shareId" element={<><MovieDetails/><LocationProbe/></>} /></Routes></MemoryRouter>);
  expect(await screen.findByText("Why ReelBot chose it")).toBeInTheDocument();
  expect(screen.getByText("The request")).toBeInTheDocument();
  expect(screen.getByText(/Tense science fiction for tonight/)).toBeInTheDocument();
  expect(screen.getAllByText("Aliens", {selector:"em"}).length).toBeGreaterThan(0);
  expect(screen.getByTestId("location")).toHaveTextContent("/p/Abcdef123456");
  expect(screen.queryByText(movie.description)).not.toBeInTheDocument();
 });


test.each([true, false])('failed Take uses stored rationale only for an active matching recommendation visit (%s)', async active => {
  const hook = useTasteProfile();
  hook.getRecommendationContextForMovie.mockReturnValue({
    source: 'reelbot_pick', prompt: 'tense sci-fi', intent: {tone: ['tense']},
    rationale: {decisionSentence: 'Stored recommendation rationale for this request.'},
  });
  axios.get.mockImplementation(url => String(url).includes('/reelbot-take')
    ? Promise.reject(new Error('unavailable')) : Promise.resolve({data: movie}));
  render(<MemoryRouter initialEntries={[{pathname:'/movies/aliens-1986', state: {source:'reelbot_pick', recommendationVisit:{movieId:active ? 679 : 123}}}]}>
    <Routes><Route path="/movies/:movieSlug" element={<MovieDetails/>}/></Routes>
  </MemoryRouter>);
  expect(await screen.findByRole('heading', {name:'ReelBot’s Take'})).toBeInTheDocument();
  if (active) expect(await screen.findByText('Stored recommendation rationale for this request.')).toBeInTheDocument();
  else {
    await waitFor(() => expect(screen.queryByRole('status', {name:'Loading ReelBot’s Take'})).not.toBeInTheDocument());
    expect(screen.queryByText('Stored recommendation rationale for this request.')).not.toBeInTheDocument();
    expect(document.querySelector('.detail-take-assessment')).toHaveTextContent('temporarily unavailable');
  }
  expect(screen.queryByText('Netflix')).not.toBeInTheDocument();
  expect(screen.getByRole('link', {name:/See all current viewing options/})).toHaveAttribute('href', movie.watch_providers.link);
  expect(screen.getByText('Provider data from JustWatch via TMDB.')).toBeInTheDocument();
});
