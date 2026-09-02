import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the ReelBot tagline', () => {
  render(<App />);
  const taglines = screen.getAllByText(/Find something worth watching/i);
  expect(taglines.length).toBeGreaterThan(0);
});

test('exposes the core navigation and global movie search', async () => {
  render(<App />);

  expect(screen.getAllByRole('link', { name: 'Now Playing' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'Browse' }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link', { name: 'My Movies' }).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'Search movies' }));
  expect(screen.getByRole('dialog', { name: 'Find a movie' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search movie titles' })).toHaveFocus());
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
