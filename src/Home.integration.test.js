import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import Home from "./Home";
import useTasteProfile from "./hooks/useTasteProfile";
import { trackProductEvent } from "./analytics";
import { recordRequestActivity } from "./productTelemetry";
import { tasteProfileService } from "./services/tasteProfileService";

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");
jest.mock("./analytics", () => ({ ...jest.requireActual("./analytics"), trackProductEvent: jest.fn() }));
jest.mock("./productTelemetry", () => ({ ...jest.requireActual("./productTelemetry"), recordRequestActivity: jest.fn() }));
jest.mock("./context/AuthContext", () => ({
  useAuth: () => ({ user: null, openAuthPrompt: jest.fn() }),
}));

const pickPayload = {
  primary: { id: 679, title: "Aliens", genre_ids: [28, 878], release_date: "1986-07-18" },
  alternates: [],
  resolved_intent: { prompt: "Under 100 minutes" },
  candidate_pool_ids: [679],
};

beforeEach(() => {
  trackProductEvent.mockImplementation(jest.requireActual("./analytics").trackProductEvent);
  recordRequestActivity.mockImplementation(jest.requireActual("./productTelemetry").recordRequestActivity);
  Element.prototype.scrollIntoView = jest.fn();
  window.localStorage.clear();
  useTasteProfile.mockReturnValue({
    profile: { skipped: [], seen: [] },
    behavioralMemory: {},
    actions: {
      clearActiveHomePick: jest.fn().mockResolvedValue(),
      recordPickResult: jest.fn().mockResolvedValue(),
      recordSwapFeedback: jest.fn().mockResolvedValue(),
      savePickPreferences: jest.fn().mockResolvedValue(),
    },
    getPickExcludedIds: jest.fn(() => []),
    getMovieState: jest.fn(() => ({ inWatchlist: false, seen: false, skipped: false, likedVibe: false })),
  });
  axios.get.mockResolvedValue({
    data: { results: [{ id: 1, title: "Arrival", release_date: "2016-11-10" }], total_pages: 1 },
  });
  axios.post.mockResolvedValue({ data: pickPayload });
});

test("clears the homepage picker after accepting a prompt while preserving the request prompt", async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const input = await screen.findByPlaceholderText(/A mood, a movie you love/i);
  fireEvent.change(input, { target: { value: "Under 100 minutes" } });
  fireEvent.click(screen.getByRole("button", { name: "Find my movie" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/pick"),
    expect.objectContaining({ prompt: "Under 100 minutes" }),
    expect.anything()
  ));
  expect(input).toHaveValue("");
});

test("does not clear an invalid homepage prompt", async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);

  const input = await screen.findByPlaceholderText(/A mood, a movie you love/i);
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Find my movie" }));

  expect(input).toHaveValue("   ");
  expect(screen.getByRole("alert")).toHaveTextContent(/Enter a vibe/i);
  expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining("/reelbot/pick"), expect.anything(), expect.anything());
});

test('a feed route starts with its own heading and exposes crawlable pagination', async()=>{
  axios.get.mockResolvedValue({data:{results:[{id:1,title:'Arrival',release_date:'2016-11-10'}],total_pages:3}});
  render(<MemoryRouter initialEntries={['/trending']}><Home routeView="popular" isFeedRoute/></MemoryRouter>);
  expect(await screen.findByRole('heading',{level:1,name:'Trending This Week'})).toBeInTheDocument();
  expect(screen.queryByRole('heading',{name:'What should I watch?'})).not.toBeInTheDocument();
  expect(await screen.findByRole('link',{name:'Next →'})).toHaveAttribute('href','/trending?page=2');
});

test('keeps submitted request beside the pick and Edit restores it without another request',async()=>{
  HTMLElement.prototype.scrollIntoView = jest.fn();
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input=await screen.findByPlaceholderText(/A mood, a movie you love/i);
  fireEvent.change(input,{target:{value:'A clever mystery under 100 minutes'}});
  fireEvent.click(screen.getByRole('button',{name:'Find my movie'}));
  await screen.findByRole('heading',{name:'Aliens'});
  expect(screen.getByText('A clever mystery under 100 minutes')).toBeVisible();
  expect(input).not.toBeVisible();
  const calls=axios.post.mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Edit',exact:true}));
  expect(input).toHaveValue('A clever mystery under 100 minutes');
  expect(axios.post.mock.calls.length).toBe(calls);
  fireEvent.click(screen.getByRole('button',{name:'Cancel edit'}));
  expect(input).not.toBeVisible();
  expect(screen.getByText('A clever mystery under 100 minutes')).toBeVisible();
  expect(axios.post.mock.calls.length).toBe(calls);
});


test('another pick preserves the committed request after the composer is cleared',async()=>{
  const prompt='Movie where people work late night at a food place';
  axios.post.mockResolvedValueOnce({data:{...pickPayload,resolved_preferences:{prompt},primary:{...pickPayload.primary,title:'The Last Shift'}}})
    .mockResolvedValueOnce({data:{...pickPayload,resolved_preferences:{prompt},primary:{...pickPayload.primary,id:78,title:'Waiting…'}}});
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input=await screen.findByPlaceholderText(/A mood, a movie you love/i);
  fireEvent.change(input,{target:{value:prompt}});fireEvent.click(screen.getByRole('button',{name:'Find my movie'}));
  await screen.findByRole('heading',{name:'The Last Shift'});expect(input).toHaveValue('');
  fireEvent.click(screen.getByRole('button',{name:'Get another pick'}));
  await screen.findByRole('heading',{name:'Waiting…'});
  expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({prompt,original_prompt:prompt,is_swap:true}));
  expect(axios.post.mock.calls[1][1].excluded_ids).toContain(679);
  expect(input).toHaveValue('');
});

test('refining a pick uses the committed request rather than the empty composer',async()=>{
  const prompt='A sci-fi movie under 150 minutes';
  axios.post.mockResolvedValueOnce({data:{...pickPayload,resolved_preferences:{prompt},primary:{...pickPayload.primary,runtime:137}}})
    .mockResolvedValueOnce({data:{...pickPayload,resolved_preferences:{prompt},primary:{...pickPayload.primary,id:78,title:'Arrival'}}});
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input=await screen.findByPlaceholderText(/A mood, a movie you love/i);
  fireEvent.change(input,{target:{value:prompt}});fireEvent.click(screen.getByRole('button',{name:'Find my movie'}));
  await screen.findByRole('heading',{name:'Aliens'});
  fireEvent.click(screen.getByRole('button',{name:'Different angle'}));
  await screen.findByRole('heading',{name:'Arrival'});
  expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({prompt,original_prompt:prompt,refinement:expect.objectContaining({id:'different_angle'})}));
});


test('a single exhausted swap does not claim five tries',async()=>{
 axios.post.mockResolvedValueOnce({data:pickPayload}).mockResolvedValueOnce({data:{primary:null,alternates:[],no_pick_reason:'no_suitable_candidate'}});
 render(<MemoryRouter><Home /></MemoryRouter>);
 fireEvent.change(await screen.findByPlaceholderText(/A mood, a movie you love/i),{target:{value:'A movie about a night shift'}});
 fireEvent.click(screen.getByRole('button',{name:'Find my movie'}));
 await screen.findByRole('heading',{name:'Aliens'});
 fireEvent.click(screen.getByRole('button',{name:'Get another pick'}));
 expect(await screen.findByText(/couldn’t find another close fit/)).toBeVisible();
 expect(screen.queryByText(/five fresh tries/)).not.toBeInTheDocument();
 expect(screen.getByRole('heading',{name:'Aliens'})).toBeInTheDocument();
});

const headlineExamples = [
  ["something that'll keep me guessing.", "Something that'll keep me guessing"],
  ['a movie everyone will love.', 'A movie everyone will love'],
  ["something that'll make me laugh.", "Something that'll make me laugh"],
  ["something I've never heard of.", "Something I've never heard of"],
  ["a movie I won't stop thinking about.", "A movie I won't stop thinking about"],
];

test.each(headlineExamples.map(([phrase, request], index) => [phrase, request, index]))('headline %s populates an editable request and only submits through the existing flow', async (phrase, request, index) => {
  const random = jest.spyOn(Math, 'random').mockReturnValue((index + .1) / headlineExamples.length);
  try {
    render(<MemoryRouter><Home /></MemoryRouter>);
    const input = await screen.findByRole('textbox', {name: 'Describe the movie you want'});
    const calls = axios.post.mock.calls.length;
    fireEvent.click(screen.getByRole('button', {name: `Use this example: ${phrase}`}));
    expect(input).toHaveValue(request);
    expect(input).toHaveFocus();
    expect(axios.post.mock.calls.length).toBe(calls);
    fireEvent.change(input, {target: {value: `${request} tonight`}});
    expect(input).toHaveValue(`${request} tonight`);
    fireEvent.change(input, {target: {value: request}});
    fireEvent.click(screen.getByRole('button', {name: 'Find my movie'}));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/reelbot/pick'),
      expect.objectContaining({prompt: request, view: 'popular', mood: 'all', runtime: 'any', source: 'library', company: 'any', include_theatrical: false, is_swap: false}),
      expect.anything()
    ));
    await screen.findByRole('heading', {name: 'Aliens'});
  } finally { random.mockRestore(); }
});

test.each(['My own request', '   '])('headline preserves existing input %p without submitting', async existing => {
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input = await screen.findByRole('textbox', {name: 'Describe the movie you want'});
  fireEvent.change(input, {target: {value: existing}});
  const calls = axios.post.mock.calls.length;
  fireEvent.click(screen.getByRole('button', {name: /^Use this example:/}));
  expect(input).toHaveValue(existing);
  expect(input).toHaveFocus();
  expect(axios.post.mock.calls.length).toBe(calls);
});

test("Home identifies successful identification outcomes in both activity streams", async () => {
  axios.post.mockResolvedValueOnce({ data: { ...pickPayload, intent: "MOVIE_IDENTIFICATION" } });
  render(<MemoryRouter><Home /></MemoryRouter>);
  fireEvent.change(await screen.findByRole("textbox", { name: "Describe the movie you want" }), { target: { value: "What was that movie where a man uses tattoos?" } });
  fireEvent.click(screen.getByRole("button", { name: "Find my movie" }));
  await screen.findByRole("heading", { name: "Aliens" });
  expect(trackProductEvent).toHaveBeenCalledWith("recommendation_returned", expect.objectContaining({ kind: "identification", outcome: "identification" }));
  expect(recordRequestActivity).toHaveBeenCalledWith(expect.objectContaining({ page: "home", kind: "identification", outcome: "pick" }));
});

test.each([
  ["MOVIE_IDENTIFICATION", "identification"],
  [undefined, "recommendation"],
])("Home no-match preserves known intent %s without guessing from the prompt", async (intent, kind) => {
  axios.post.mockResolvedValueOnce({ data: { primary: null, alternates: [], no_pick_reason: "no_suitable_candidate", intent, user_message: "Another clue would help." } });
  render(<MemoryRouter><Home /></MemoryRouter>);
  fireEvent.change(await screen.findByRole("textbox", { name: "Describe the movie you want" }), { target: { value: "What was that movie where a man uses tattoos?" } });
  fireEvent.click(screen.getByRole("button", { name: "Find my movie" }));
  await waitFor(() => expect(trackProductEvent).toHaveBeenCalledWith("recommendation_failed", expect.objectContaining({ kind, outcome: "no_match" })));
  expect(recordRequestActivity).toHaveBeenCalledWith(expect.objectContaining({ page: "home", kind, outcome: "no_match" }));
});


test('Edit restores its saved request and autofocus without suppressing the new headline reveal', async () => {
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input = await screen.findByRole('textbox', { name: 'Describe the movie you want' });
  fireEvent.input(input, { target: { value: 'A clever mystery under 100 minutes' } });
  expect(screen.getByRole('button', { name: /^Use this example:/ })).toHaveClass('is-settled');
  fireEvent.click(screen.getByRole('button', { name: 'Find my movie' }));
  await screen.findByRole('heading', { name: 'Aliens' });
  const calls = axios.post.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  await waitFor(() => expect(input).toHaveFocus());
  expect(input).toHaveValue('A clever mystery under 100 minutes');
  const example = screen.getByRole('button', { name: /^Use this example:/ });
  expect(example).not.toHaveClass('is-settled');
  fireEvent.wheel(document);
  fireEvent.pointerEnter(example);
  expect(example).not.toHaveClass('is-settled');
  fireEvent.click(example);
  expect(input).toHaveValue('A clever mystery under 100 minutes');
  expect(example).toHaveClass('is-settled');
  expect(axios.post.mock.calls.length).toBe(calls);
});


test('a saved Home request starts its reveal without overwriting or submitting the draft', async () => {
  tasteProfileService.saveHomePickSession({ originalPrompt: 'My saved mystery request' });
  render(<MemoryRouter><Home /></MemoryRouter>);
  const input = await screen.findByRole('textbox', { name: 'Describe the movie you want' });
  expect(input).toHaveValue('My saved mystery request');
  const example = screen.getByRole('button', { name: /^Use this example:/ });
  expect(example).not.toHaveClass('is-settled');
  fireEvent.focus(input);
  expect(example).not.toHaveClass('is-settled');
  fireEvent.input(input, { target: { value: 'My edited mystery request' } });
  expect(example).toHaveClass('is-settled');
  expect(axios.post).not.toHaveBeenCalled();
});
