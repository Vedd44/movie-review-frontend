import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import Home from './Home';
import useTasteProfile from './hooks/useTasteProfile';
import useMovieNews from './news/useMovieNews';

jest.mock('axios');
jest.mock('./hooks/useTasteProfile');
jest.mock('./news/useMovieNews');
jest.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, openAuthPrompt: jest.fn() }),
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  window.localStorage.clear();
  useTasteProfile.mockReturnValue({
    profile: { skipped: [], seen: [] }, behavioralMemory: {}, actions: {},
    getPickExcludedIds: jest.fn(() => []),
    getMovieState: jest.fn(() => ({})),
  });
  axios.get.mockResolvedValue({data:{results:[],total_pages:1}});
  useMovieNews.mockReturnValue({status:'ready',snapshot:{version:1,updatedAt:new Date().toISOString(),items:[{
    id:'test',headline:'A film returns',summary:'Publisher copy.',take:'A separate opinion.',
    sourceName:'Publisher',sourceUrl:'https://variety.com/test',publishedAt:new Date().toISOString(),
  }]}});
});

afterEach(() => jest.restoreAllMocks());

test.each(['2026-10-24T12:00:00Z','2026-11-24T12:00:00Z'])('news follows the illustrated how-to section in %s', async date => {
  const now = new Date(date).getTime();
  jest.spyOn(Date, 'now').mockReturnValue(now);
  useMovieNews.mockReturnValue({status:'ready',snapshot:{version:1,updatedAt:date,items:[{
    id:'test',headline:'A film returns',summary:'Publisher copy.',take:'A separate opinion.',
    sourceName:'Publisher',sourceUrl:'https://variety.com/test',publishedAt:date,
  }]}});
  render(<MemoryRouter><Home /></MemoryRouter>);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  const news = await screen.findByRole('region',{name:'Movie news'});
  const howTo = screen.getByRole('region',{name:"Tell ReelBot the part you can't put into a filter."});
  // DOM adjacency is the requirement, beyond accessible reading order alone.
  // eslint-disable-next-line testing-library/no-node-access
  expect(howTo.nextElementSibling).toBe(news);
  expect(screen.getAllByRole('region',{name:'Movie news'})).toHaveLength(1);
  expect(within(howTo).getAllByRole('article')).toHaveLength(3);
});

test('standalone movie feeds do not gain homepage news or how-to sections', async () => {
  render(<MemoryRouter initialEntries={['/trending']}><Home routeView="popular" isFeedRoute /></MemoryRouter>);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  expect(screen.queryByRole('region',{name:'Movie news'})).not.toBeInTheDocument();
  expect(screen.queryByRole('region',{name:"Tell ReelBot the part you can't put into a filter."})).not.toBeInTheDocument();
});
