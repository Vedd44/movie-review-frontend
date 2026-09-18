import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';

test('renders the ReelBot tagline', () => {
  render(<App />);
  const taglines = screen.getAllByText(/Find something worth watching/i);
  expect(taglines.length).toBeGreaterThan(0);
});

test('exposes the core navigation and global movie search', async () => {
  render(<App />);

  screen.getAllByRole('navigation', { name: 'Primary' }).forEach((navigation) => {
    expect(within(navigation).queryByRole('link', { name: 'Now Playing' })).not.toBeInTheDocument();
  });
  expect(screen.getAllByRole('link', { name: 'Browse' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'My Movies' }).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'Search movies' }));
  expect(screen.getByRole('dialog', { name: 'Find a movie' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search movie titles' })).toHaveFocus());
});

test('keeps discovery modes out of the footer navigation', () => {
  render(<App />);
  const footer = screen.getByRole('navigation', { name: 'Footer' });
  expect(within(footer).getByRole('link', { name: 'Ask ReelBot' })).toHaveAttribute('href', '/#pick-for-me');
  expect(within(footer).getByRole('link', { name: 'Browse' })).toBeInTheDocument();
  expect(within(footer).getByRole('link', { name: 'My Movies' })).toBeInTheDocument();
  expect(within(footer).queryByRole('link', { name: 'Now Playing' })).not.toBeInTheDocument();
  expect(within(footer).queryByRole('link', { name: 'Coming Soon' })).not.toBeInTheDocument();
});

test('defaults homepage discovery to Trending', () => {
  render(<App />);
  expect(screen.getByRole('button', { name: 'Trending' })).toHaveClass('active');
});

test('navigates to the Now Playing feed and its poster grid', async () => {
  const scrollIntoView = jest.fn();
  Element.prototype.scrollIntoView = scrollIntoView;

  window.history.pushState({}, '', '/now-playing');
  render(<App />);

  await waitFor(() => expect(window.location.pathname).toBe('/now-playing'));
  expect(document.getElementById('movie-grid')).toBeInTheDocument();
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  window.history.pushState({}, '', '/');
});

test('frames account creation around remembered utility', () => {
  render(<App />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' })[0]);

  expect(screen.getByRole('heading', { name: 'Make ReelBot yours.' })).toBeInTheDocument();
  expect(screen.getByText(/Save picks, keep track of what you’ve watched/i)).toBeInTheDocument();
});

test('opens contextual Ask ReelBot without replacing search', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Ask ReelBot/i }));

  expect(screen.getByRole('dialog', { name: 'Ask ReelBot' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pick for date night' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Ask ReelBot' })).toBeInTheDocument();
});
