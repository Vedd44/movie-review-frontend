import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import BrowseLibrary from "./BrowseLibrary";
import { CollectionsIndex } from "./CollectionPage";
import useTasteProfile from "./hooks/useTasteProfile";
import { useAuth } from "./context/AuthContext";
import { clearBrowseHistory } from "./browseHistory";

jest.mock("axios");
jest.mock("./hooks/useTasteProfile");
jest.mock("./context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./analytics", () => ({ ...jest.requireActual("./analytics"), trackProductEvent: jest.fn() }));
jest.mock("./productTelemetry", () => ({ ...jest.requireActual("./productTelemetry"), recordRequestActivity: jest.fn(), deferProductTelemetry: jest.fn() }));
const movies = (prefix, offset, count = 12) => Array.from({length: count}, (_, i) => ({
  id: offset + i, title: `${prefix} ${i}`, genre_ids: [878, 35], poster_path: "/fixture.jpg",
  release_date: "2000-01-01", popularity: 100-i, vote_count: 500,
}));
function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button><output data-testid="url">{location.pathname}{location.search}</output></>;
}
function Journey({entry = "/browse?genre=878"}) {
  return <MemoryRouter initialEntries={[entry]}><Navigation/><Routes>
    <Route path="/browse" element={<BrowseLibrary/>}/>
    <Route path="/collections" element={<CollectionsIndex/>}/>
    <Route path="/movies/:slug" element={<h1>Movie detail</h1>}/>
  </Routes></MemoryRouter>;
}
beforeEach(() => {
  clearBrowseHistory();
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
  Object.defineProperty(window, 'scrollY', {configurable:true, value:0});
  useAuth.mockReturnValue({user:null,openAuthPrompt:jest.fn()});
  useTasteProfile.mockReturnValue({profile:{skipped:[],seen:[]},behavioralMemory:{},actions:{},getPickExcludedIds:()=>[]});
  axios.get.mockImplementation(url => {
    if(url.includes('/genres')) return Promise.resolve({data:{genres:[{id:878,name:'Science Fiction'},{id:35,name:'Comedy'}]}});
    const page = new URL(url).searchParams.get('page');
    const genre = new URL(url).searchParams.get('genre');
    return Promise.resolve({data:{results:movies(`${genre} page ${page}`, Number(genre)*100+Number(page)*20),total_pages:3}});
  });
});
test.each(['878','35'])('restores the entire progressive list after detail, Back and Forward for genre %s', async genre => {
  render(<Journey entry={`/browse?genre=${genre}`}/>);
  await screen.findByRole('heading',{name:`${genre} page 1 0`});
  fireEvent.click(screen.getByRole('link',{name:'Load more'}));
  await screen.findByRole('heading',{name:`${genre} page 2 0`});
  const before = screen.getAllByRole('heading',{level:3}).map(x=>x.textContent);
  expect(before).toHaveLength(24);
  Object.defineProperty(window,'scrollY',{configurable:true,value:1800});
  fireEvent.click(screen.getByRole('link',{name:`Open ${genre} page 1 11`}));
  expect(await screen.findByRole('heading',{name:'Movie detail'})).toBeInTheDocument();
  Object.defineProperty(window,'scrollY',{configurable:true,value:0});
  fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
  await screen.findByRole('heading',{name:`${genre} page 1 11`});
  expect(screen.getAllByRole('heading',{level:3}).map(x=>x.textContent)).toEqual(before);
  expect(window.scrollTo).toHaveBeenCalledWith({top:1800,behavior:'instant'});
  fireEvent.click(screen.getByRole('button',{name:'Browser forward'}));
  await screen.findByRole('heading',{name:'Movie detail'});
  fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
  await screen.findByRole('heading',{name:`${genre} page 1 11`});
  expect(screen.getAllByRole('heading',{level:3}).map(x=>x.textContent)).toEqual(before);
  expect(axios.get.mock.calls.filter(([url])=>url.includes('/movies?'))).toHaveLength(2);
});
test('changing genre after return replaces the prior list and resets pagination', async()=>{
  render(<Journey/>);
  await screen.findByRole('heading',{name:'878 page 1 0'});
  fireEvent.click(screen.getByRole('link',{name:'Load more'}));
  await screen.findByRole('heading',{name:'878 page 2 0'});
  fireEvent.click(screen.getByRole('link',{name:'Open 878 page 1 0'}));
  fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
  await screen.findByRole('heading',{name:'878 page 1 0'});
  await waitFor(()=>expect(screen.getByLabelText('Genre')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Genre'),{target:{value:'35'}});
  await screen.findByRole('heading',{name:'35 page 1 0'});
  expect(screen.queryByRole('heading',{name:'878 page 1 0'})).not.toBeInTheDocument();
  expect(screen.getByTestId('url').textContent).toContain('page=1');
});
test('a fresh page-2 deep link retains existing single-page semantics',async()=>{
  render(<Journey entry='/browse?genre=878&page=2'/>);
  await screen.findByRole('heading',{name:'878 page 2 0'});
  expect(screen.queryByRole('heading',{name:'878 page 1 0'})).not.toBeInTheDocument();
  expect(axios.get.mock.calls.filter(([url])=>url.includes('/movies?'))).toHaveLength(1);
});
test('a pending page request cannot overwrite a newer filter or its return snapshot',async()=>{
  let resolveOld;
  const normalGet=axios.get.getMockImplementation();
  axios.get.mockImplementation(url=>url.includes('page=2')?new Promise(resolve=>{resolveOld=resolve;}):normalGet(url));
  render(<Journey/>);
  await screen.findByRole('heading',{name:'878 page 1 0'});
  fireEvent.click(screen.getByRole('link',{name:'Load more'}));
  await waitFor(()=>expect(resolveOld).toBeDefined());
  await waitFor(()=>expect(screen.getByLabelText('Genre')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Genre'),{target:{value:'35'}});
  await screen.findByRole('heading',{name:'35 page 1 0'});
  resolveOld({data:{results:movies('stale',9000),total_pages:3}});
  fireEvent.click(screen.getByRole('link',{name:'Open 35 page 1 0'}));
  fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
  await screen.findByRole('heading',{name:'35 page 1 0'});
  expect(screen.queryByRole('heading',{name:'stale 0'})).not.toBeInTheDocument();
});
test('automatic initial fill survives return with the original first-page candidate',async()=>{
 const normalGet=axios.get.getMockImplementation();
 axios.get.mockImplementation(url=>url.includes('/movies?') && new URL(url).searchParams.get('page')==='1'
  ?Promise.resolve({data:{results:movies('first fill',7000,10),total_pages:2}}):normalGet(url));
 render(<Journey/>);
 await screen.findByRole('heading',{name:'878 page 2 0'});
 expect(screen.getAllByRole('heading',{level:3})).toHaveLength(22);
 fireEvent.click(screen.getByRole('link',{name:'Open first fill 9'}));
 await screen.findByRole('heading',{name:'Movie detail'});
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'first fill 9'});
 expect(screen.getAllByRole('heading',{level:3})).toHaveLength(22);
});
test('a failed extra page does not replace the last successful history snapshot',async()=>{
 const normalGet=axios.get.getMockImplementation();
 axios.get.mockImplementation(url=>url.includes('/movies?') && new URL(url).searchParams.get('page')==='2'
  ?Promise.reject(new Error('offline fixture')):normalGet(url));
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 render(<Journey/>);
 await screen.findByRole('heading',{name:'878 page 1 0'});
 fireEvent.click(screen.getByRole('link',{name:'Load more'}));
 await screen.findByText('Failed to fetch browse library movies.');
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'878 page 1 0'});
 expect(screen.getAllByRole('heading',{level:3})).toHaveLength(12);
 log.mockRestore();
});
test('opening an existing film during Load more preserves its prefix and resumes the pending page on return',async()=>{
 const normalGet=axios.get.getMockImplementation();
 const pending=[];
 axios.get.mockImplementation(url=>url.includes('/movies?') && new URL(url).searchParams.get('page')==='2'
  ?new Promise(resolve=>pending.push(resolve)):normalGet(url));
 render(<Journey/>);
 await screen.findByRole('heading',{name:'878 page 1 0'});
 fireEvent.click(screen.getByRole('link',{name:'Load more'}));
 await waitFor(()=>expect(pending).toHaveLength(1));
 Object.defineProperty(window,'scrollY',{configurable:true,value:1200});
 fireEvent.click(screen.getByRole('link',{name:'Open 878 page 1 0'}));
 await screen.findByRole('heading',{name:'Movie detail'});
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'878 page 1 0'});
 await waitFor(()=>expect(pending).toHaveLength(2));
 pending[0]({data:{results:movies('cancelled',9000),total_pages:3}});
 pending[1]({data:{results:movies('resumed',9100),total_pages:3}});
 await screen.findByRole('heading',{name:'resumed 0'});
 expect(screen.getByRole('heading',{name:'878 page 1 0'})).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'cancelled 0'})).not.toBeInTheDocument();
 expect(screen.getAllByRole('heading',{level:3})).toHaveLength(24);
 expect(window.scrollTo).toHaveBeenCalledWith({top:1200,behavior:'instant'});
});
test('pending automatic fill stays on its page across Back Forward Back and never skips the resumed page',async()=>{
 const normalGet=axios.get.getMockImplementation();
 const pending=[];
 axios.get.mockImplementation(url=>{
  if(!url.includes('/movies?'))return normalGet(url);
  const page=new URL(url).searchParams.get('page');
  if(page==='1')return Promise.resolve({data:{results:movies('small prefix',7000,10),total_pages:4}});
  if(page==='2')return new Promise(resolve=>pending.push(resolve));
  return normalGet(url);
 });
 render(<Journey/>);
 await screen.findByRole('heading',{name:'small prefix 0'});
 await waitFor(()=>expect(pending).toHaveLength(1));
 fireEvent.click(screen.getByRole('link',{name:'Open small prefix 0'}));
 await screen.findByRole('heading',{name:'Movie detail'});
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'small prefix 0'});
 await waitFor(()=>expect(pending).toHaveLength(2));
 expect(screen.getByTestId('url').textContent).toContain('page=2');
 fireEvent.click(screen.getByRole('button',{name:'Browser forward'}));
 await screen.findByRole('heading',{name:'Movie detail'});
 fireEvent.click(screen.getByRole('button',{name:'Browser back'}));
 await screen.findByRole('heading',{name:'small prefix 0'});
 await waitFor(()=>expect(pending).toHaveLength(3));
 expect(screen.getByTestId('url').textContent).toContain('page=2');
 expect(axios.get.mock.calls.some(([url])=>url.includes('page=3'))).toBe(false);
 pending[2]({data:{results:movies('resumed fill',9100),total_pages:4}});
 await screen.findByRole('heading',{name:'resumed fill 0'});
 expect(screen.getAllByRole('heading',{level:3})).toHaveLength(22);
});

test('return keeps the displayed order after detail recency changes and still honors explicit exclusions', async () => {
  const normalGet = axios.get.getMockImplementation();
  axios.get.mockImplementation(url => normalGet(url).then(response => ({ data: { ...response.data, total_pages: 1 } })));
  const taste = { profile: { skipped: [], seen: [] }, behavioralMemory: { preferredGenres: { 878: 1 } }, actions: {}, getPickExcludedIds: () => [] };
  useTasteProfile.mockReturnValue(taste);
  render(<Journey />);
  await screen.findByRole('heading', { name: '878 page 1 0' });
  const before = screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent);
  fireEvent.click(screen.getByRole('link', { name: 'Open 878 page 1 0' }));
  await screen.findByRole('heading', { name: 'Movie detail' });
  // Detail visits update recentMovies; use the real Browse scorer with that new memory.
  useTasteProfile.mockReturnValue({ ...taste, behavioralMemory: { ...taste.behavioralMemory, recentMovieIds: [87820] } });
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await screen.findByRole('heading', { name: '878 page 1 0' });
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(before);
  fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
  await screen.findByRole('heading', { name: 'Movie detail' });
  useTasteProfile.mockReturnValue({ ...taste, profile: { ...taste.profile, skipped: [{ id: 87820 }] } });
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await screen.findByRole('heading', { name: '878 page 1 1' });
  expect(screen.queryByRole('heading', { name: '878 page 1 0' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(before.slice(1));
});


test('era discovery opens the existing category and Back restores the progressive Browse list', async () => {
  render(<Journey/>);
  await screen.findByRole('heading', {name:'878 page 1 0'});
  fireEvent.click(screen.getByRole('link', {name:'Load more'}));
  await screen.findByRole('heading', {name:'878 page 2 0'});
  const before = screen.getAllByRole('heading', {level:3}).map(node => node.textContent);
  const disclosure = document.querySelector('.browse-filter-disclosure');
  disclosure.open = true;
  fireEvent(disclosure, new Event('toggle'));
  Object.defineProperty(window, 'scrollY', {configurable:true, value:120});
  fireEvent.click(screen.getByRole('link', {name:'Explore movies across the decades'}));
  expect(screen.getByTestId('url')).toHaveTextContent('/collections?category=era');
  expect(await screen.findByRole('button', {name:'Era', exact:true})).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', {name:'Browser back'}));
  await screen.findByRole('heading', {name:'878 page 2 0'});
  expect(screen.getAllByRole('heading', {level:3}).map(node => node.textContent)).toEqual(before);
  await waitFor(() => expect(screen.getByLabelText('Genre')).toHaveValue('878'));
  expect(document.querySelector('.browse-filter-disclosure')).toHaveAttribute('open');
  expect(screen.getByTestId('url')).toHaveTextContent('/browse?genre=878&page=2');
  expect(window.scrollTo).toHaveBeenCalledWith({top:120, behavior:'instant'});
  expect(axios.get.mock.calls.filter(([url]) => url.includes('/movies?'))).toHaveLength(2);
});
