import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import WatchAvailability from './WatchAvailability';
import {fetchWatchmodeAvailability} from '../services/watchmodeService';
import {trackProductEvent} from '../analytics';
jest.mock('../services/watchmodeService');
jest.mock('../analytics',()=>({trackProductEvent:jest.fn()}));
const fallback={region:'US',link:'https://www.themoviedb.org/movie/278/watch',subscription:[{id:8,name:'Netflix',logo_path:'/netflix.jpg'}],rent:[],buy:[]};
const enhanced={source:'watchmode',region:'US',subscription:[{id:203,name:'Netflix',direct_url:'https://www.netflix.com/title/123'}],rent:[{id:2,name:'Apple TV',direct_url:'https://tv.apple.com/movie/123'}],free:[{id:9,name:'Tubi',direct_url:'https://tubitv.com/movies/123'}],cable:[],buy:[]};
let visibility,observers;
beforeEach(()=>{
 jest.clearAllMocks();observers=[];
 window.IntersectionObserver=jest.fn(callback=>{visibility=callback;const observer={observe:jest.fn(),disconnect:jest.fn()};observers.push(observer);return observer;});
 fetchWatchmodeAvailability.mockResolvedValue(enhanced);
});
afterEach(()=>{delete window.IntersectionObserver;});
test('looks up availability only when visible, then supplies direct links, attribution and click metadata',async()=>{
 render(<WatchAvailability movie={{id:278}} availability={fallback} sectionId="watch"/>);
 expect(fetchWatchmodeAvailability).not.toHaveBeenCalled();expect(screen.queryByRole('link',{name:'Watch on Netflix'})).toBeNull();
 await act(async()=>visibility([{isIntersecting:true}]));
 expect(fetchWatchmodeAvailability).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('link',{name:'Watch on Netflix'})).toHaveAttribute('href','https://www.netflix.com/title/123');
 expect(screen.getByRole('link',{name:'Rent on Apple TV'})).toHaveAttribute('href','https://tv.apple.com/movie/123');
 expect(screen.getByRole('heading',{name:'Free'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Watchmode'})).toHaveAttribute('href','https://www.watchmode.com/');
 expect(screen.getByRole('link',{name:'Watch on Netflix'})).not.toHaveAttribute('rel',expect.stringContaining('sponsored'));
 fireEvent.click(screen.getByRole('link',{name:'Rent on Apple TV'}));
 expect(trackProductEvent).toHaveBeenCalledWith('provider_clicked',{movie_id:278,provider_id:2,provider_name:'Apple TV',availability_type:'rent',source:'watchmode'});
 expect(trackProductEvent).toHaveBeenCalledWith('watch_options_viewed',{movie_id:278,source:'watchmode'});
 await act(async()=>visibility([{isIntersecting:true}]));expect(fetchWatchmodeAvailability).toHaveBeenCalledTimes(1);
});
test('keeps TMDB availability on a quota or API fallback',async()=>{
 fetchWatchmodeAvailability.mockResolvedValue(null);
 render(<WatchAvailability movie={{id:278}} availability={fallback}/>);
 await act(async()=>visibility([{isIntersecting:true}]));
 expect(screen.queryByRole('link',{name:'View Netflix options on TMDB'})).toBeNull();expect(screen.queryByRole('link',{name:'Watch on Netflix'})).toBeNull();
 expect(screen.getByText('Provider data from JustWatch via TMDB.')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:/See all current viewing options/})).toHaveAttribute('href',fallback.link);
 expect(trackProductEvent).toHaveBeenCalledWith('watch_options_viewed',{movie_id:278,source:'tmdb'});
});
test('ignores a previous movie lookup completing after navigation',async()=>{
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const view=render(<WatchAvailability movie={{id:278}} availability={fallback}/>);
 act(()=>visibility([{isIntersecting:true}]));
 view.rerender(<WatchAvailability movie={{id:679}} availability={{...fallback,subscription:[{id:9,name:'Hulu'}]}}/>);
 await act(async()=>resolve(enhanced));expect(screen.queryByRole('link',{name:'Watch on Netflix'})).toBeNull();expect(screen.queryByRole('link',{name:'View Hulu options on TMDB'})).toBeNull();
 await act(async()=>visibility([{isIntersecting:true}]));await waitFor(()=>expect(screen.getByRole('link',{name:'Watch on Netflix'})).toBeInTheDocument());
});
test('never renders unsafe provider URLs as links',async()=>{
 fetchWatchmodeAvailability.mockResolvedValue({...enhanced,subscription:[{id:1,name:'Unsafe',direct_url:'javascript:alert(1)'}]});
 render(<WatchAvailability movie={{id:278}} availability={fallback}/>);await act(async()=>visibility([{isIntersecting:true}]));
 expect(screen.queryByRole('link',{name:'Watch on Unsafe'})).toBeNull();
});

test('uses one TMDB action instead of individual options buttons',async()=>{
 render(<WatchAvailability movie={{id:278}} availability={{...fallback,rent:[{id:3,name:'YouTube',logo_path:'/youtube.jpg'}]}}/>);
 await act(async()=>visibility([{isIntersecting:true}]));
 expect(screen.queryByRole('link',{name:'View YouTube options on TMDB'})).toBeNull();
 const link=screen.getByRole('link',{name:/See all current viewing options/});
 expect(link).toHaveAttribute('href',fallback.link);
 fireEvent.click(link);expect(trackProductEvent).toHaveBeenCalledWith('viewing_options_clicked',{movie_id:278,source:'watchmode'});
 expect(screen.queryByText(/Additional options from JustWatch via TMDB/)).toBeNull();
});

test('retains the single TMDB destination even with no availability data',async()=>{
 fetchWatchmodeAvailability.mockResolvedValue(null);
 render(<WatchAvailability movie={{id:278}} availability={null}/>);
 await act(async()=>visibility([{isIntersecting:true}]));
 expect(screen.getByRole('link',{name:/See all current viewing options/})).toHaveAttribute('href','https://www.themoviedb.org/movie/278/watch?locale=US');
 expect(screen.getByText('Use TMDB to see current streaming, rental, and purchase options.')).toBeInTheDocument();
});


test('shows a pending status for a slow lookup, keeping the TMDB action usable',async()=>{
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 render(<WatchAvailability movie={{id:278}} availability={fallback}/>);
 expect(screen.queryByRole('status')).toBeNull();
 act(()=>visibility([{isIntersecting:true}]));
 expect(screen.getByRole('status')).toHaveTextContent('Checking streaming, rental, and purchase options…');
 expect(screen.getByRole('link',{name:/See all current viewing options/})).toHaveAttribute('href',fallback.link);
 await act(async()=>resolve(enhanced));
 expect(screen.queryByRole('status')).toBeNull();
 expect(screen.getByRole('link',{name:'Watch on Netflix'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Watchmode'})).toBeInTheDocument();
});

test('does not show the empty fallback as final while the lookup is pending',async()=>{
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 render(<WatchAvailability movie={{id:278}} availability={null}/>);
 act(()=>visibility([{isIntersecting:true}]));
 expect(screen.getByRole('status')).toBeInTheDocument();
 expect(screen.queryByText('Use TMDB to see current streaming, rental, and purchase options.')).toBeNull();
 expect(screen.getByRole('link',{name:/See all current viewing options/})).toBeInTheDocument();
 await act(async()=>resolve(null));
 expect(screen.queryByRole('status')).toBeNull();
 expect(screen.getByText('Use TMDB to see current streaming, rental, and purchase options.')).toBeInTheDocument();
 expect(screen.getByText('Provider data from JustWatch via TMDB.')).toBeInTheDocument();
});

test('does not carry a previous movie pending state into a new movie',async()=>{
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const view=render(<WatchAvailability movie={{id:278}} availability={fallback}/>);
 act(()=>visibility([{isIntersecting:true}]));
 expect(screen.getByRole('status')).toBeInTheDocument();
 view.rerender(<WatchAvailability movie={{id:679}} availability={null}/>);
 expect(screen.queryByRole('status')).toBeNull();
 await act(async()=>resolve(enhanced));
 expect(screen.queryByRole('status')).toBeNull();
 expect(screen.queryByRole('link',{name:'Watch on Netflix'})).toBeNull();
 await act(async()=>visibility([{isIntersecting:true}]));
 expect(screen.queryByRole('status')).toBeNull();
 expect(screen.getByRole('link',{name:'Watch on Netflix'})).toBeInTheDocument();
});

test('ignores completion after unmount and starts only one lookup for repeated visibility callbacks',async()=>{
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 const view=render(<WatchAvailability movie={{id:278}} availability={fallback}/>);
 act(()=>{visibility([{isIntersecting:true}]);visibility([{isIntersecting:true}]);});
 expect(fetchWatchmodeAvailability).toHaveBeenCalledTimes(1);
 expect(screen.getByRole('status')).toBeInTheDocument();
 view.unmount();
 await act(async()=>resolve(enhanced));
 expect(trackProductEvent).not.toHaveBeenCalled();
});

test('shows and clears pending feedback through the visibility fallback without IntersectionObserver',async()=>{
 delete window.IntersectionObserver;
 let resolve;fetchWatchmodeAvailability.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
 render(<WatchAvailability movie={{id:278}} availability={null}/>);
 expect(screen.getByRole('status')).toBeInTheDocument();
 fireEvent.scroll(window);fireEvent.resize(window);
 expect(fetchWatchmodeAvailability).toHaveBeenCalledTimes(1);
 await act(async()=>resolve(null));
 expect(screen.queryByRole('status')).toBeNull();
 expect(screen.getByText('Use TMDB to see current streaming, rental, and purchase options.')).toBeInTheDocument();
});
