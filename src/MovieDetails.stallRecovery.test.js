import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import MovieDetails from "./MovieDetails";
import { useAuth } from "./context/AuthContext";
import useTasteProfile from "./hooks/useTasteProfile";
import { fetchWatchmodeAvailability } from "./services/watchmodeService";

jest.mock("axios");
jest.mock("./context/AuthContext", () => ({ useAuth: jest.fn(() => ({ user: null })) }));
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
  useAuth.mockReturnValue({ user: null });
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


const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
afterEach(() => jest.useRealTimers());
test('healthy collection state and back navigation perform one detail request per route without an effect loop', async()=>{
 const other={...movie,id:2787,title:'Pitch Black',release_date:'2000-02-18',release_year:2000};
 axios.get.mockImplementation(url => Promise.resolve(String(url).includes('/reelbot-take') ? {data:{take:generatedTake}} : {data:String(url).includes('pitch-black')?other:movie}));
 function Nav(){const nav=useNavigate();return <><Link to='/movies/pitch-black-2000'>Next film</Link><button onClick={()=>nav(-1)}>History back</button></>}
 const state={source:'collection',collectionVisit:{slug:'best-movies-of-the-1980s',movieId:679,moviePath:'/movies/aliens-1986'}};
 render(<MemoryRouter initialEntries={[{pathname:'/movies/aliens-1986',state}]}><Nav/><Routes><Route path='/movies/:movieSlug' element={<MovieDetails/>}/></Routes></MemoryRouter>);
 await screen.findByRole('heading',{name:'Aliens'});fireEvent.click(screen.getByText('Next film'));await screen.findByRole('heading',{name:'Pitch Black'});fireEvent.click(screen.getByText('History back'));await screen.findByRole('heading',{name:'Aliens'});
 const detailCalls=axios.get.mock.calls.filter(([url])=>!String(url).includes('/reelbot-take'));
 expect(detailCalls).toHaveLength(3);
 expect(detailCalls.map(([url])=>url.split('/resolve/')[1])).toEqual(['aliens-1986','pitch-black-2000','aliens-1986']);
});
test('navigation away from stalled detail recovers and ignores a late abandoned response', async()=>{
 let release;
 axios.get.mockImplementation(url => String(url).includes('/resolve/stalled-film') ? new Promise(resolve=>{release=resolve;}) : Promise.resolve(String(url).includes('/reelbot-take')?{data:{take:generatedTake}}:{data:movie}));
 render(<MemoryRouter initialEntries={['/movies/stalled-film']}><Link to='/movies/aliens-1986'>Next film</Link><Routes><Route path='/movies/:movieSlug' element={<MovieDetails/>}/></Routes></MemoryRouter>);
 expect(screen.getByText('Loading movie details...')).toBeInTheDocument();
 const signal=axios.get.mock.calls[0][1].signal;
 fireEvent.click(screen.getByText('Next film'));await screen.findByRole('heading',{name:'Aliens'});expect(signal.aborted).toBe(true);
 await act(async()=>{release({data:{...movie,id:1,title:'Stale film'}});await flush();});
 expect(screen.getByRole('heading',{name:'Aliens'})).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'Stale film'})).not.toBeInTheDocument();
});

test('timeout error offers explicit reload, and the same collection visit recovers on retry', async()=>{
 const originalLocation=window.location;const reload=jest.fn();
 delete window.location; window.location={...originalLocation,reload};
 const state={source:'collection',collectionVisit:{slug:'best-movies-of-the-1980s',movieId:679,moviePath:'/movies/aliens-1986'}};
 const view=()=> <MemoryRouter initialEntries={[{pathname:'/movies/aliens-1986',state}]}><Routes><Route path='/movies/:movieSlug' element={<MovieDetails/>}/></Routes></MemoryRouter>;
 try {
  axios.get.mockRejectedValue(Object.assign(new Error('timeout'),{code:'ECONNABORTED'}));
  const first=render(view());
  await screen.findByRole('heading',{name:'Unable to load this movie'});
  fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(reload).toHaveBeenCalledTimes(1);expect(axios.get).toHaveBeenCalledTimes(1);
  first.unmount();
  axios.get.mockImplementation(url=>Promise.resolve(String(url).includes('/reelbot-take')?{data:{take:generatedTake}}:{data:movie}));
  render(view());await screen.findByRole('heading',{name:'Aliens'});
  expect(screen.getByRole('link',{name:'Back to Best Movies of the 1980s'})).toHaveAttribute('href','/collections/best-movies-of-the-1980s');
  expect(screen.queryByRole('heading',{name:'Unable to load this movie'})).not.toBeInTheDocument();
 } finally {delete window.location;window.location=originalLocation;}
});
