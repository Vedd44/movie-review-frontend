import React from 'react';
import { render, screen } from '@testing-library/react';
import ReviewExcerpts from './ReviewExcerpts';

const url = 'https://www.themoviedb.org/review/5e0000000000000000000001';

test('does not turn rating-based positive/negative slots into sentiment claims', () => {
  render(<ReviewExcerpts highlights={{count: 4, positive: {content: 'A great film.', author: 'One', rating: 8}, negative: {content: '<em>Fargo</em> is superb.', author: 'Two', rating: 7, url}}} />);
  expect(screen.getByRole('heading', {name: 'Viewer reviews'})).toBeInTheDocument();
  expect(screen.queryByText('What lands')).not.toBeInTheDocument();
  expect(screen.queryByText('What misses')).not.toBeInTheDocument();
  expect(screen.getByText('“Fargo is superb.”')).toBeInTheDocument();
  expect(screen.getByText('Two • 7/10')).toBeInTheDocument();
  expect(screen.getAllByText('Review excerpt')).toHaveLength(2);
  expect(screen.getByRole('link', {name: 'Read full review on TMDB by Two (opens in a new tab)'})).toHaveAttribute('href', url);
});

test('missing ratings and URLs do not invent polarity, scores or full text', () => {
  render(<ReviewExcerpts highlights={{positive: {content: 'Only supplied excerpt…'}}} />);
  expect(screen.getByText('“Only supplied excerpt…”')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('TMDB reviewer')).toBeInTheDocument();
});

test('keeps escaped source markup inert and rejects unsupported links', () => {
  const {container} = render(<ReviewExcerpts highlights={{negative: {content: '&lt;img src=x onerror=alert(1)&gt;', url: 'javascript:alert(1)'}}} />);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('“<img src=x onerror=alert(1)>”')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

test('omits an empty section', () => {
  const {container} = render(<ReviewExcerpts highlights={{positive: {content: ' <br> '}, negative: null}} />);
  expect(container).toBeEmptyDOMElement();
});
