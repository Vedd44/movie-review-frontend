import { buildAbsoluteUrl } from '../siteConfig';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MovieNews, { MovieNewsHome, NewsCard } from './MovieNews';
import { validatePublicSnapshot } from './useMovieNews';
import useMovieNews from './useMovieNews';
jest.mock('./useMovieNews', () => ({ __esModule: true, default: jest.fn(), validatePublicSnapshot: jest.requireActual('./useMovieNews').validatePublicSnapshot }));
const story = { id:'one', headline:'A restoration returns to cinemas', summary:'The publisher’s exact description.', take:'A useful interpretation.', sourceName:'Publisher', sourceUrl:'https://variety.com/a', author:'Author', publishedAt:new Date().toISOString(), editorialReviewedAt:new Date().toISOString() };
const ready = items => ({ status:'ready', snapshot:{ version:1, updatedAt:new Date().toISOString(), items }, retry:jest.fn() });
const mount = element => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => { window.scrollTo=jest.fn(); useMovieNews.mockReturnValue(ready([story])); });
test('renders unchanged RSS copy as text with separate take and direct source links', () => {
 mount(<NewsCard story={{...story, headline:'<script>not executable</script>'}} />);
 expect(screen.getByRole('heading')).toHaveTextContent('<script>not executable</script>');
 expect(screen.getByText(story.summary)).toBeInTheDocument();
 expect(screen.getByText('ReelBot’s Take')).toBeInTheDocument();
 const source=screen.getByRole('link',{name:/Read at Publisher/}); expect(source).toHaveAttribute('target','_blank'); expect(source).toHaveAttribute('rel','noopener noreferrer');
 expect(screen.getByText('By Author')).toBeInTheDocument();
 expect(screen.queryByText(/licence|Adapted/)).not.toBeInTheDocument();
});
test('home hides loading, empty, failed and stale selections', () => {
 for (const value of [{status:'loading'}, {status:'error'}, ready([]), {...ready([story]),snapshot:{items:[story],updatedAt:'2020-01-01T00:00:00Z'}}]) {
  useMovieNews.mockReturnValue(value); const view=mount(<MovieNewsHome/>); expect(screen.queryByRole('heading')).not.toBeInTheDocument(); view.unmount();
 }
});
test('home shows latest three stories with exact descriptions and /news link', () => {
 useMovieNews.mockReturnValue(ready(Array.from({length:5},(_,i)=>({...story,id:String(i)}))));
 mount(<MovieNewsHome/>); expect(screen.getAllByRole('article')).toHaveLength(3); expect(screen.getAllByText(story.summary)).toHaveLength(3);
 expect(screen.getByRole('link',{name:/All movie news/})).toHaveAttribute('href','/news');
});
test('feed loading, error/retry and empty states are useful', () => {
 useMovieNews.mockReturnValue({status:'loading'}); const view=mount(<MovieNews/>); expect(screen.getByRole('status')).toHaveTextContent('Loading'); view.unmount();
 const retry=jest.fn(); useMovieNews.mockReturnValue({status:'error',retry}); const error=mount(<MovieNews/>); fireEvent.click(screen.getByRole('button',{name:'Try again'})); expect(retry).toHaveBeenCalledTimes(1); error.unmount();
 useMovieNews.mockReturnValue(ready([])); mount(<MovieNews/>); expect(screen.getByRole('link',{name:/Explore movie collections/})).toHaveAttribute('href','/collections');
});
test('feed caps at 25, retains visible stale content and noindex metadata', () => {
 const value=ready(Array.from({length:30},(_,i)=>({...story,id:String(i)}))); value.snapshot.updatedAt='2020-01-01T00:00:00Z'; useMovieNews.mockReturnValue(value);
 mount(<MovieNews/>); expect(screen.getByRole('status')).toHaveTextContent('not been updated recently'); expect(screen.getAllByRole('article')).toHaveLength(25);
 expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');
 expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href',buildAbsoluteUrl('/news'));
});
test('adapter rejects unsafe/synthetic/future entries, strips internal fields and deduplicates', () => {
 expect(()=>validatePublicSnapshot({items:[]})).toThrow();
 const result=validatePublicSnapshot({version:1,items:[{...story,reviewerSecret:'not public'},story,{...story,synthetic:true},{...story,sourceUrl:'javascript:alert(1)'},{...story,publishedAt:'2099-01-01'}]});
 expect(result.items).toHaveLength(1); expect(result.items[0].reviewerSecret).toBeUndefined();
});
test('adapter sorts newest first and limits to 25 without rewriting publisher text', () => {
 const items=Array.from({length:30},(_,i)=>({...story,id:String(i),sourceUrl:`https://variety.com/${i}`,publishedAt:new Date(Date.now()-i*1000).toISOString()})).reverse();
 const result=validatePublicSnapshot({version:1,items}); expect(result.items).toHaveLength(25); expect(result.items[0].id).toBe('0'); expect(result.items[0].summary).toBe(story.summary);
});
test('headings remain plain without generic promotional tagline', () => {
 mount(<MovieNewsHome/>); expect(screen.getByRole('heading',{name:'Movie news'})).toBeInTheDocument(); expect(screen.queryByText(/What’s happening in film/)).not.toBeInTheDocument();
});
