import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PickContender, { comparisonFacts, comparisonReason, HomeContenderProvider, useHomeContender } from './PickContender';

const current = { primary: { id: 2, title: 'Current', runtime: 110, release_date: '2025-01-01', poster_path: '/current.jpg', reason: 'A playful mystery with a warm comic voice.' } };
const previous = { primary: { id: 1, title: 'Previous', runtime: 112, release_date: '2001-01-01', overview: 'A long plot synopsis.' }, rationale: { primary_reason: 'A gentler mystery with dry wit and an offbeat detective.' } };

test('no first-pick banner or identical-film comparison', () => {
  const { rerender } = render(<PickContender current={current} />);
  expect(screen.queryByRole('region', { name: 'Previous pick' })).not.toBeInTheDocument();
  rerender(<PickContender current={current} held={{ primary: { ...current.primary, id: '2' } }} />);
  expect(screen.queryByRole('region', { name: 'Previous pick' })).not.toBeInTheDocument();
});
test('comparison uses existing reasons and supporting metadata, never plot or genre-based claims', () => {
  expect(comparisonFacts({ runtime: 0, genre_names: ['Animation'], release_date: 'unknown' })).toEqual({ runtime: null, year: null });
  expect(comparisonReason({ primary: { genre_names: ['Animation'], overview: 'A plot.' } })).toBe('');
  expect(comparisonReason({ primary: { reason: ' A reason.\n Another sentence. ' } })).toBe('A reason. Another sentence.');
  render(<PickContender current={current} held={previous} />);
  expect(screen.getByText('Previous pick:')).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Which feels right tonight?' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  expect(screen.getByText(current.primary.reason)).toBeVisible();
  expect(screen.getByText(previous.rationale.primary_reason)).toBeVisible();
  expect(screen.getByText(/110 min/)).toBeVisible();
  expect(screen.getByText(/112 min/)).toBeVisible();
  expect(screen.queryByText(/shorter|long plot synopsis/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Return to Previous' })).toBeVisible();
});
test('missing metadata and reason remain explicit without fabricated fit', () => {
  render(<PickContender current={{ primary: { id: 2, title: 'Current' } }} held={{ primary: { id: 1, title: 'Previous' } }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  expect(screen.getAllByText(/Runtime unavailable/)).toHaveLength(2);
  expect(screen.getAllByText('A recommendation reason isn’t available for this pick.')).toHaveLength(2);
});
test('previous pick is memory-only, survives child navigation, and clears on identity changes without remounting', () => {
  let mounts = 0;
  function Child({ active }) {
    React.useEffect(() => { mounts += 1; }, []);
    const [held, setHeld] = useHomeContender();
    return active ? <button onClick={() => setHeld(previous)}>{held?.primary.title || 'Remember fixture'}</button> : null;
  }
  const { rerender } = render(<HomeContenderProvider identity="guest"><Child active /></HomeContenderProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Remember fixture' }));
  rerender(<HomeContenderProvider identity="guest"><Child active={false} /></HomeContenderProvider>);
  rerender(<HomeContenderProvider identity="guest"><Child active /></HomeContenderProvider>);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeVisible();
  rerender(<HomeContenderProvider identity="signed-in"><Child active /></HomeContenderProvider>);
  expect(screen.getByRole('button', { name: 'Remember fixture' })).toBeVisible();
  expect(mounts).toBe(1);
});
test('busy and editing states disable direct return, comparison and choices', () => {
  const { rerender } = render(<PickContender current={current} held={previous} disabled />);
  expect(screen.getByRole('button', { name: 'Compare picks' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Return to Previous' })).toBeDisabled();
  rerender(<PickContender current={current} held={previous} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  rerender(<PickContender current={current} held={previous} disabled />);
  expect(screen.getByRole('button', { name: 'Return to Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Stay with Current' })).toBeDisabled();
});
test('a new pair starts collapsed, including after clearing previous context', () => {
  const { rerender } = render(<PickContender current={current} held={previous} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  rerender(<PickContender current={{ primary: { id: 3, title: 'Next' } }} held={current} />);
  expect(screen.getByRole('button', { name: 'Compare picks' })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  rerender(<PickContender current={current} held={null} />);
  rerender(<PickContender current={current} held={previous} />);
  expect(screen.getByRole('button', { name: 'Compare picks' })).toHaveAttribute('aria-expanded', 'false');
});
test('return and stay restore focus to the comparison action', async () => {
  function Harness() {
    const [pick, setPick] = React.useState(current);
    const [prior, setPrior] = React.useState(previous);
    return <PickContender current={pick} held={prior} onReturn={() => { setPick(prior); setPrior(pick); }} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Return to Previous' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Compare picks' })).toHaveFocus());
  expect(screen.getByRole('status')).toHaveTextContent('Returned to Previous.');
  fireEvent.click(screen.getByRole('button', { name: 'Compare picks' }));
  fireEvent.click(screen.getByRole('button', { name: 'Stay with Previous' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Compare picks' })).toHaveFocus());
});
