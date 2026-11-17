import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import SearchResults from './SearchResults';

jest.mock('axios');
jest.mock('./hooks/useWatchProviderBadges', () => () => ({}));
jest.mock('./seo', () => ({ buildBreadcrumbJsonLd: () => null, buildItemListJsonLd: () => null, usePageMetadata: () => {} }));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const payload = title => ({data:{results:[{id:title === 'Alien' ? 348 : 578,title,release_date:'1979-01-01'}]}});
const flush = async fn => { await act(async () => { fn(); await Promise.resolve(); }); };
const submit = query => { fireEvent.change(screen.getByRole('textbox', {name:'Search movies'}), {target:{value:query}}); fireEvent.click(screen.getByRole('button', {name:'Search Again'})); };

beforeEach(() => { jest.clearAllMocks(); axios.isCancel.mockReturnValue(false); });

test('an obsolete search completing cannot dismiss the current loading state or show stale films', async () => {
 const old = deferred(), current = deferred();
 axios.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 render(<MemoryRouter initialEntries={['/search?q=Alien']}><SearchResults /></MemoryRouter>);
 submit('Jaws');
 await flush(() => old.resolve(payload('Alien')));
 expect(screen.getByText('Searching movies...')).toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Alien',exact:true})).not.toBeInTheDocument();
 await flush(() => current.resolve(payload('Jaws')));
 expect(screen.getByRole('heading',{name:'Jaws',exact:true})).toBeInTheDocument();
});

test('an obsolete failure cannot replace newer successful results with an error', async () => {
 const old = deferred(), current = deferred();
 axios.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 render(<MemoryRouter initialEntries={['/search?q=Alien']}><SearchResults /></MemoryRouter>);
 submit('Jaws');
 await flush(() => current.resolve(payload('Jaws')));
 await flush(() => old.reject(new Error('Late failure')));
 expect(screen.getByRole('heading',{name:'Jaws',exact:true})).toBeInTheDocument();
 expect(screen.queryByText('Failed to fetch search results.')).not.toBeInTheDocument();
});

test('cancelling a previous search does not end the new search loading state', async () => {
 const old = deferred(), current = deferred();
 axios.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
 render(<MemoryRouter initialEntries={['/search?q=Alien']}><SearchResults /></MemoryRouter>);
 submit('Jaws');
 await flush(() => old.reject({code:'ERR_CANCELED'}));
 expect(screen.getByText('Searching movies...')).toBeInTheDocument();
 await flush(() => current.resolve(payload('Jaws')));
 expect(screen.getByRole('heading',{name:'Jaws',exact:true})).toBeInTheDocument();
});
