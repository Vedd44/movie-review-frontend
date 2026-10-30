import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CollectionPage from './CollectionPage';
import { getCollection } from './collections';
import { collectionItemList } from './collectionEditorial';
import movies from './generatedCollectionMovies.json';
jest.mock('./components/CollectionPreviewCard', () => () => null);
jest.mock('./context/AskReelbotContext', () => ({useAskReelbotPageContext: jest.fn()}));
function show(slug) {
  return render(<MemoryRouter initialEntries={['/collections/'+slug]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path="/collections/:collectionSlug" element={<CollectionPage/>}/></Routes></MemoryRouter>);
}
test('adult animation renders all eight notes and content guidance with matching shared schema', async () => {
  const collection = getCollection('animated-movies-for-adults');
  show(collection.slug);
  await waitFor(() => expect(screen.queryByText('Loading collection...')).not.toBeInTheDocument());
  expect(screen.getByText(collection.contentNote)).toBeInTheDocument();
  for (const note of Object.values(collection.movieNotes)) expect(screen.getByText(note)).toBeInTheDocument();
  const schema = JSON.parse(document.querySelector('script[data-reelbot-schema="1"]').textContent);
  expect(schema).toEqual(collectionItemList(collection,collection.movies.map(slug=>movies[slug]),window.location.origin));
  expect(document.querySelectorAll('.collection-movie-card')).toHaveLength(8);
});
test('Cozy Fall notes appear only on that collection', async () => {
  const view = show('cozy-fall-movies');
  await waitFor(() => expect(screen.getByText(getCollection('cozy-fall-movies').movieNotes['you-ve-got-mail-1998'])).toBeInTheDocument());
  view.unmount();
  show('best-comfort-movies');
  await waitFor(() => expect(screen.queryByText('Loading collection...')).not.toBeInTheDocument());
  expect(document.querySelectorAll('.collection-movie-note')).toHaveLength(0);
  expect(document.querySelector('.collection-content-note')).toBeNull();
});

test('Haunted uses concise complete copy and standard movie cards without per-film notes', async () => {
  const collection = getCollection('haunted-house-ghost-stories');
  show(collection.slug);
  await waitFor(() => expect(screen.queryByText('Loading collection...')).not.toBeInTheDocument());
  expect(collection.description.length).toBeLessThan(180);
  expect(collection.description).toMatch(/\.$/);
  expect(collection.movieNotes).toBeUndefined();
  expect(screen.getByText(collection.description)).toBeInTheDocument();
  expect(collection.contentNote).toBeUndefined();
  expect(document.querySelector('.collection-content-note')).toBeNull();
  expect(screen.getByRole('heading', { level: 1, name: 'Best Haunted House Movies' })).toBeInTheDocument();
  expect(document.title).toBe('Best Haunted House Movies | ReelBot Collections');
  expect(document.querySelector('meta[property="og:image"]')).toHaveAttribute('content',window.location.origin+'/social/collections/haunted-house-ghost-stories-v6.jpg');
  expect(document.querySelectorAll('.collection-movie-card')).toHaveLength(8);
  expect(document.querySelectorAll('.collection-movie-note')).toHaveLength(0);
});

test.each(['Open When Harry Met Sally...', 'When Harry Met Sally...'])('%s carries film-bound return state without changing canonical URLs', async name => {
 const Probe = () => <output data-testid="visit">{JSON.stringify(useLocation().state)}</output>;
 render(<MemoryRouter initialEntries={['/collections/cozy-fall-movies']}><Routes><Route path="/collections/:collectionSlug" element={<CollectionPage/>}/><Route path="/movies/:slug" element={<Probe/>}/></Routes></MemoryRouter>);
 const link = await screen.findByRole('link',{name});
 expect(link).toHaveAttribute('href','/movies/when-harry-met-sally-1989');
 fireEvent.click(link);
 expect(JSON.parse(screen.getByTestId('visit').textContent)).toMatchObject({source:'collection',collectionVisit:{slug:'cozy-fall-movies',moviePath:'/movies/when-harry-met-sally-1989'}});
});
