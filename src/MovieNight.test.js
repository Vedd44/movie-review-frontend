import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MovieNight from './MovieNight';
jest.mock('./seo', () => ({usePageMetadata:jest.fn()}));

afterEach(() => { delete global.fetch; });
test('loads at most three real movies concurrently, rejects mismatched IDs and shares only the chosen title', async () => {
  global.fetch=jest.fn(async url => ({ok:true,json:async()=>({id:url.endsWith('/3')?99:Number(url.split('/').pop()),title:url.endsWith('/1')?'Groundhog Day':'Palm Springs',canonical_slug:'test-movie',runtime:101})}));
  const writeText=jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  render(<MemoryRouter initialEntries={['/movie-night?movies=1,2,3,4&choice=1']}><MovieNight /></MemoryRouter>);
  await screen.findByText('Shared vote:',{exact:false});
  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(screen.getAllByRole('button',{name:'I’d watch this'})).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button',{name:'I’d watch this'})[1]);
  fireEvent.click(screen.getByRole('button',{name:'Send my vote'}));
  await waitFor(()=>expect(writeText).toHaveBeenCalled());
  expect(writeText.mock.calls[0][0]).toContain('My vote is Palm Springs');
  expect(writeText.mock.calls[0][0]).toContain('choice=2');
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
test('empty or unavailable links offer a recovery path, never generate a pick', async () => {
  global.fetch=jest.fn().mockResolvedValue({ok:false});
  render(<MemoryRouter initialEntries={['/movie-night?movies=broken']}><MovieNight /></MemoryRouter>);
  await screen.findByRole('link',{name:'Find a movie'});
  expect(global.fetch).not.toHaveBeenCalled();
});
