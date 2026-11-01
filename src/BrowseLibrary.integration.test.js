import { clearBrowseHistory } from "./browseHistory";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import BrowseLibrary from "./BrowseLibrary";
import useTasteProfile from "./hooks/useTasteProfile";
import { useAuth } from "./context/AuthContext";
import { trackProductEvent } from "./analytics";
import { recordRequestActivity } from "./productTelemetry";
import { DISCOVERY_PROMPTS } from "./discovery";

// Keep pagination fixtures above the automatic first-grid fill threshold.
const browsePadding = Array.from({ length: 11 }, (_, i) => ({ id: 8000 + i, title: `Catalog fixture ${i}`, genre_ids: [28], poster_path: "/fixture.jpg", release_date: "2000-01-01", popularity: 20, vote_count: 100 }));

jest.mock("axios");
jest.mock("./analytics", () => ({ ...jest.requireActual("./analytics"), trackProductEvent: jest.fn() }));
jest.mock("./productTelemetry", () => ({ ...jest.requireActual("./productTelemetry"), recordRequestActivity: jest.fn() }));
test('failed continuation keeps the successful pick and visibly explains the limit', async () => {
 render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
 await screen.findByRole('heading', {name:'Movies'});
 fireEvent.click(screen.getByRole('button', {name:'Ask ReelBot to pick one'}));
 fireEvent.click(screen.getByRole('button', {name:'Pick for me',exact:true}));
 await screen.findByRole('link', {name:'View details'});
 axios.post.mockResolvedValueOnce({data:{primary:null,alternates:[],no_pick_reason:'no_suitable_candidate',user_message:'No other film fits the active runtime limit. Would you like to relax it?'}});
 fireEvent.click(screen.getByRole('button', {name:'Get another pick'}));
 expect(await screen.findByText('No other film fits the active runtime limit. Would you like to relax it?')).toBeInTheDocument();
 expect(screen.getByRole('link', {name:'View details'})).toBeInTheDocument();
});
jest.mock("./hooks/useTasteProfile");
jest.mock("./context/AuthContext", () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  clearBrowseHistory();
  trackProductEvent.mockImplementation(jest.requireActual("./analytics").trackProductEvent);
  recordRequestActivity.mockImplementation(jest.requireActual("./productTelemetry").recordRequestActivity);
  useAuth.mockReturnValue({ user: null, openAuthPrompt: jest.fn(), maybePromptToSavePicks: jest.fn() });
  Element.prototype.scrollIntoView = jest.fn();
  useTasteProfile.mockReturnValue({
    profile: { skipped: [], seen: [] },
    behavioralMemory: {},
    actions: {
      savePickPreferences: jest.fn().mockResolvedValue(),
      recordPickResult: jest.fn().mockResolvedValue(),
      recordSwapFeedback: jest.fn().mockResolvedValue(),
    },
    getPickExcludedIds: jest.fn(() => []),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
    isCloudSyncing: false,
  });
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    return Promise.resolve({ data: { results: [{ id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 }], total_pages: 3, total_results: 60 } });
  });
  axios.post.mockResolvedValue({
    data: {
      primary: { id: 679, title: "Aliens", genre_ids: [28, 878], release_date: "1986-07-18" },
      alternates: [],
      resolved_intent: { tone: ["dark"] },
      candidate_pool_ids: [679],
    },
  });
});

test("labelled selects and a typed prompt reach the existing constrained picker", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);

  expect(await screen.findByRole("heading", { name: "Movies" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Trending" })).toHaveClass("active");
  expect(screen.getByRole("button", { name: "Now Playing" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Coming Soon" })).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "Mood" }), {target:{value:"dark"}});
  fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), {target:{value:"28"}});
  fireEvent.change(screen.getByRole("combobox", { name: "Runtime" }), {target:{value:"under_two_hours"}});
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot to pick one/i }));

  const picker = document.getElementById("library-reelbot-picker");
  fireEvent.change(within(picker).getByRole("textbox", {name:"Add a vibe (optional)"}), {target:{value:"A gritty thriller"}});
  fireEvent.click(within(picker).getByRole("checkbox", { name: /Include movies still in theaters/i }));
  fireEvent.click(within(picker).getByRole("button", { name: "Pick for me" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  const requestBody = axios.post.mock.calls[0][1];
  expect(requestBody).toMatchObject({
    prompt: "A gritty thriller",
    view: "popular",
    mood: "dark",
    runtime: "under_two_hours",
    genre: "28",
    include_theatrical: true,
  });
});

test.each(['button', 'Enter'])("filter-only picking has one clear action and preserves constraints via %s", async (method) => {
  render(<MemoryRouter initialEntries={["/browse?view=latest&mood=dark&genre=28&runtime=under_two_hours"]}><BrowseLibrary /></MemoryRouter>);
  await screen.findByRole('option', { name: 'Action' });
  fireEvent.click(screen.getByRole('button', { name: 'Ask ReelBot to pick one' }));
  expect(screen.getByText('Using Now Playing · Action · Under 2 hours · Dark')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit prompt' })).not.toBeInTheDocument();
  expect(screen.queryByText('Let ReelBot choose from these filters, or add one detail.')).not.toBeInTheDocument();
  const input = screen.getByRole('textbox', { name: 'Add a vibe (optional)' });
  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Pick for me' })).toBeEnabled();
  if (method === 'Enter') fireEvent.keyDown(input, { key: 'Enter' });
  else fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  await screen.findByRole('link', { name: 'View details' });
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1]).toMatchObject({ prompt: '', view: 'latest', mood: 'dark', genre: '28', runtime: 'under_two_hours', include_theatrical: false });
});

test('inspiration is optional, keeps every existing example, and never submits on selection', async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask ReelBot to pick one' }));
  const inspiration = screen.getByText('Need inspiration?');
  expect(inspiration.closest('details')).not.toHaveAttribute('open');
  fireEvent.click(inspiration);
  expect(inspiration.closest('details')).toHaveAttribute('open');
  for (const prompt of DISCOVERY_PROMPTS.slice(0, 4)) {
    fireEvent.click(screen.getByRole('button', { name: prompt }));
    expect(screen.getByRole('textbox', { name: 'Add a vibe (optional)' })).toHaveValue(prompt);
  }
  expect(axios.post).not.toHaveBeenCalled();
  fireEvent.click(inspiration);
  expect(inspiration.closest('details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Clear prompt' }));
  expect(screen.getByRole('textbox', { name: 'Add a vibe (optional)' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Pick for me' })).toBeEnabled();
});

test('pending picks prevent another submission and failed picks restore the same request for retry', async () => {
  let rejectPick;
  axios.post.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectPick = reject; }));
  const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Ask ReelBot to pick one' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Add a vibe (optional)' }), { target: { value: 'A quiet mystery' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Include movies still in theaters' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Finding your pick…', hidden: true })).toBeDisabled();
  expect(screen.getByRole('checkbox', { hidden: true })).toBeDisabled();
  await act(async () => rejectPick(new Error('Temporary failure')));
  expect(screen.getByText('ReelBot could not narrow the library right now.')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Add a vibe (optional)' })).toHaveValue('A quiet mystery');
  expect(screen.getByRole('checkbox', { name: 'Include movies still in theaters' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Pick for me' }));
  await screen.findByRole('link', { name: 'View details' });
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(axios.post.mock.calls[1][1]).toMatchObject({ prompt: 'A quiet mystery', include_theatrical: true });
  logged.mockRestore();
});

test("load more appends a unique page and keeps the existing results", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("link", { name: "Load more" }));

  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Aliens" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("type=popular&page=2"));
});

test("changing source resets progressive results to the new first page", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [] } });
    if (url.includes("type=latest")) return Promise.resolve({ data: { results: [
      { id: 1091, title: "The Thing", genre_ids: [27, 878], poster_path: "/thing.jpg", release_date: "1982-06-25", popularity: 70, vote_count: 900 },
    ], total_pages: 1 } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Load more" }));
  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Now Playing" }));

  expect(await screen.findByRole("heading", { name: "The Thing" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Aliens" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pitch Black" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("type=latest&page=1"));
});

test("changing a filter resets progressive results to the filtered first page", async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/genres")) return Promise.resolve({ data: { genres: [{ id: 28, name: "Action" }] } });
    if (url.includes("genre=28")) return Promise.resolve({ data: { results: [
      { id: 218, title: "The Terminator", genre_ids: [28, 878], poster_path: "/terminator.jpg", release_date: "1984-10-26", popularity: 75, vote_count: 950 },
    ], total_pages: 1 } });
    if (url.includes("page=2")) return Promise.resolve({ data: { results: [
      { id: 2787, title: "Pitch Black", genre_ids: [28, 878], poster_path: "/pitch-black.jpg", release_date: "2000-02-18", popularity: 60, vote_count: 800 },
    ], total_pages: 2 } });
    return Promise.resolve({ data: { results: [
      { id: 679, title: "Aliens", genre_ids: [28, 878], poster_path: "/aliens.jpg", release_date: "1986-07-18", popularity: 80, vote_count: 1000 },
    ].concat(browsePadding), total_pages: 2 } });
  });

  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Load more" }));
  expect(await screen.findByRole("heading", { name: "Pitch Black" })).toBeInTheDocument();

  fireEvent.change(await screen.findByRole("combobox", { name: "Genre" }), {target:{value:"28"}});

  expect(await screen.findByRole("heading", { name: "The Terminator" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Aliens" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Pitch Black" })).not.toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("page=1&genre=28"));
});


test("editing and cancelling a Browse request preserves the displayed pick without another request", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Ask ReelBot to pick one/i }));
  const picker = document.getElementById("library-reelbot-picker");
  fireEvent.change(within(picker).getByRole("textbox", { name: "Add a vibe (optional)" }), {target:{value:"A smart sci-fi movie"}});
  fireEvent.click(within(picker).getByRole("button", { name: "Pick for me" }));
  await waitFor(() => expect(within(picker).getByRole("heading", {name:"Aliens"})).toBeInTheDocument());
  expect(useAuth().maybePromptToSavePicks).not.toHaveBeenCalled();
  expect(useAuth().openAuthPrompt).not.toHaveBeenCalled();
  fireEvent.click(within(picker).getByRole("button", {name:"Create account"}));
  expect(useAuth().openAuthPrompt).toHaveBeenCalledWith("session_browse_inline");
  const count = axios.post.mock.calls.length;
  expect(within(picker).getByText("A smart sci-fi movie")).toBeVisible();
  expect(within(picker).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(within(picker).getByRole("button", {name:"Edit"}));
  fireEvent.change(within(picker).getByRole("textbox", {name:"Add a vibe (optional)"}), {target:{value:"Different draft"}});
  expect(within(picker).getByRole("button", {name:"Get another pick"})).toBeDisabled();
  fireEvent.click(within(picker).getByRole("button", {name:"Cancel edit"}));
  expect(within(picker).getByRole("heading", {name:"Aliens"})).toBeInTheDocument();
  expect(within(picker).getByText("A smart sci-fi movie")).toBeVisible();
  expect(axios.post).toHaveBeenCalledTimes(count);
  fireEvent.click(within(picker).getByRole("button", {name:"Edit"}));
  expect(within(picker).getByRole("textbox", {name:"Add a vibe (optional)"})).toHaveValue("A smart sci-fi movie");
});


test('Browse another pick preserves the submitted prompt after a cancelled edit',async()=>{
  const prompt='Movie where people work late night at a food place';
  axios.post.mockResolvedValueOnce({data:{primary:{id:679,title:'The Last Shift',genre_ids:[18]},alternates:[],resolved_preferences:{prompt},candidate_pool_ids:[679]}})
    .mockResolvedValueOnce({data:{primary:{id:78,title:'Waiting…',genre_ids:[35]},alternates:[],resolved_preferences:{prompt},candidate_pool_ids:[78]}});
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button',{name:/Ask ReelBot to pick one/i}));
  const picker=document.getElementById('library-reelbot-picker');
  fireEvent.change(within(picker).getByRole('textbox',{name:'Add a vibe (optional)'}),{target:{value:prompt}});
  fireEvent.click(within(picker).getByRole('button',{name:'Pick for me'}));
  await within(picker).findByRole('heading',{name:'The Last Shift'});
  fireEvent.click(within(picker).getByRole('button',{name:'Edit'}));
  fireEvent.change(within(picker).getByRole('textbox',{name:'Add a vibe (optional)'}),{target:{value:'Different draft'}});
  fireEvent.click(within(picker).getByRole('button',{name:'Cancel edit'}));
  fireEvent.click(within(picker).getByRole('button',{name:'Get another pick'}));
  await within(picker).findByRole('heading',{name:'Waiting…'});
  expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({prompt,original_prompt:prompt,is_swap:true}));
});

test("Browse identifies successful identification outcomes in both activity streams", async () => {
  axios.post.mockResolvedValueOnce({ data: { intent: "MOVIE_IDENTIFICATION", primary: { id: 77, title: "Memento" }, alternates: [] } });
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Ask ReelBot to pick one" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Add a vibe (optional)" }), { target: { value: "What was that movie where a man uses tattoos?" } });
  fireEvent.click(screen.getByRole("button", { name: "Pick for me", exact: true }));
  await screen.findByRole("heading", { name: "Memento" });
  expect(trackProductEvent).toHaveBeenCalledWith("recommendation_returned", expect.objectContaining({ page: "browse", kind: "identification", outcome: "identification" }));
  expect(recordRequestActivity).toHaveBeenCalledWith(expect.objectContaining({ page: "browse", kind: "identification", outcome: "pick" }));
});

test.each([
  ["MOVIE_IDENTIFICATION", "identification"],
  [undefined, "recommendation"],
])("Browse no-match preserves known intent %s without guessing from the prompt", async (intent, kind) => {
  axios.post.mockResolvedValueOnce({ data: { primary: null, alternates: [], no_pick_reason: "no_suitable_candidate", intent, user_message: "Another clue would help." } });
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Ask ReelBot to pick one" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Add a vibe (optional)" }), { target: { value: "What was that movie where a man uses tattoos?" } });
  fireEvent.click(screen.getByRole("button", { name: "Pick for me", exact: true }));
  await screen.findByText("Another clue would help.");
  expect(trackProductEvent).toHaveBeenCalledWith("recommendation_failed", expect.objectContaining({ page: "browse", kind, outcome: "no_match" }));
  expect(recordRequestActivity).toHaveBeenCalledWith(expect.objectContaining({ page: "browse", kind, outcome: "no_match" }));
});


test('leaving Browse aborts its pending pick, releases telemetry, and ignores its late result',async()=>{
 const previous=process.env.NODE_ENV,originalFetch=global.fetch,oldCrypto=window.crypto;
 const consent=require('./cookieConsent'),telemetry=require('./productTelemetry');
 let resolvePick;
 axios.post.mockImplementationOnce(()=>new Promise(resolve=>{resolvePick=resolve;}));
 const view=render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
 await screen.findByRole('heading',{name:'Movies'});
 process.env.NODE_ENV='production';let number=0;
 Object.defineProperty(window,'crypto',{configurable:true,value:{randomUUID:()=>`00000000-0000-4000-8000-${String(++number).padStart(12,'0')}`}});
 global.fetch=jest.fn().mockResolvedValue({ok:true,status:202});consent.setCookieChoice('accepted');jest.useFakeTimers();
 try{
  fireEvent.click(screen.getByRole('button',{name:'Ask ReelBot to pick one'}));
  fireEvent.click(screen.getByRole('button',{name:'Pick for me',exact:true}));
  expect(resolvePick).toBeDefined();
  const options=axios.post.mock.calls[0][2];expect(options.timeout).toBe(90000);expect(options.signal.aborted).toBe(false);
  view.unmount();expect(options.signal.aborted).toBe(true);
  const finish=telemetry.deferProductTelemetry();telemetry.recordProductTelemetry('recommendation_requested');finish();
  telemetry.recordProductTelemetry('page_viewed',{page:'home'});
  // Use ordinary batching rather than pagehide, which would mask a leaked slot.
  await act(async()=>{jest.advanceTimersByTime(5000);for(let i=0;i<30;i++)await Promise.resolve();});
  expect(global.fetch).toHaveBeenCalled();
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).events.some(e=>e.name==='page_viewed')).toBe(true);
  await act(async()=>{resolvePick({data:{primary:{id:679,title:'Late result'},alternates:[]}});});
  expect(useTasteProfile().actions.recordPickResult).not.toHaveBeenCalled();
 }finally{view.unmount();consent.setCookieChoice('rejected');jest.clearAllTimers();jest.useRealTimers();process.env.NODE_ENV=previous;global.fetch=originalFetch;Object.defineProperty(window,'crypto',{configurable:true,value:oldCrypto});}
},10000);


test("Browse offers a quiet route to era collections without replacing discovery controls", async () => {
  render(<MemoryRouter><BrowseLibrary /></MemoryRouter>);
  const eraLink = screen.getByRole("link", { name: "Explore movies across the decades" });
  expect(eraLink).toHaveAttribute("href", "/collections?category=era");
  expect(eraLink.closest(".browse-copy")).not.toBeNull();
  expect(screen.getByRole("button", { name: "Trending" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Ask ReelBot to pick one" })).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Aliens" })).toBeInTheDocument();
});


test("runtime verification 503 stops automatic fill and does not cascade through pages", async () => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => {});
  axios.get.mockClear();
  axios.get.mockImplementation(url => url.includes("/genres")
    ? Promise.resolve({data:{genres:[]}})
    : Promise.reject(Object.assign(new Error("runtime unavailable"), {response:{status:503, headers:{"retry-after":"30"}}})));
  render(<MemoryRouter initialEntries={["/browse?runtime=under_two_hours&page=1&view=popular"]}><BrowseLibrary /></MemoryRouter>);
  expect(await screen.findByText("Failed to fetch browse library movies.")).toBeInTheDocument();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/movies?"))).toHaveLength(1);
  expect(screen.queryByText("Nothing great matched that exactly. Try loosening one filter.")).not.toBeInTheDocument();
  logged.mockRestore();
});


test("sparse runtime matches stop automatic lookahead at three pages but allow manual Load more", async () => {
  axios.get.mockClear();
  axios.get.mockImplementation(url => Promise.resolve({data:url.includes("/genres")
    ? {genres:[]} : {results:[],total_pages:500,total_results:10000}}));
  render(<MemoryRouter initialEntries={["/browse?runtime=under_two_hours&page=1&view=popular"]}><BrowseLibrary /></MemoryRouter>);
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.includes("/movies?"))).toHaveLength(3));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/movies?"))).toHaveLength(3);
  fireEvent.click(screen.getByRole("link", {name:"Load more"}));
  await waitFor(() => expect(axios.get.mock.calls.filter(([url]) => url.includes("/movies?"))).toHaveLength(4));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
  expect(axios.get.mock.calls.filter(([url]) => url.includes("/movies?"))).toHaveLength(4);
});
