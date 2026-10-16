import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
