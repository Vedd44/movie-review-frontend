import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PickContender, { comparisonFacts, HomeContenderProvider, useHomeContender } from './PickContender';

test('comparison uses known fields, never genre-derived mood or suitability', () => {
  expect(comparisonFacts({ runtime: 0, genre_names: ['Animation', 'Thriller'], release_date: 'unknown' })).toEqual({ runtime: null, year: null, overview: '' });
  expect(comparisonFacts({ runtime: '77', release_date: '2005-09-12', overview: ' A story. ' })).toEqual({ runtime: 77, year: '2005', overview: 'A story.' });
});
test('missing metadata is explicit and does not generate a comparison claim', () => {
  render(<PickContender current={{ primary: { id: 2, title: 'Current' } }} held={{ primary: { id: 1, title: 'Held' } }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare the two' }));
  expect(screen.getAllByText('Not available')).toHaveLength(4);
  expect(screen.queryByText(/shorter/)).not.toBeInTheDocument();
});
test('holding is memory-only and survives child navigation within its provider', () => {
  function Child({ active }) {
    const [held, setHeld] = useHomeContender();
    return active ? <button onClick={() => setHeld({ primary: { title: 'Held' } })}>{held?.primary.title || 'Keep'}</button> : null;
  }
  const { rerender } = render(<HomeContenderProvider><Child active /></HomeContenderProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
  rerender(<HomeContenderProvider><Child active={false} /></HomeContenderProvider>);
  rerender(<HomeContenderProvider><Child active /></HomeContenderProvider>);
  expect(screen.getByRole('button', { name: 'Held' })).toBeVisible();
});
test('busy state prevents comparison mutations', () => {
  render(<PickContender current={{ primary: { id: 2, title: 'Current' } }} held={{ primary: { id: 1, title: 'Held' } }} disabled />);
  expect(screen.getByRole('button', { name: 'Compare the two' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Remove Held as an option' })).toBeDisabled();
});
test('clearing a held option closes comparison before a new pair is kept', () => {
  const current = { primary: { id: 2, title: 'Current' } };
  const held = { primary: { id: 1, title: 'Held' } };
  const { rerender } = render(<PickContender current={current} held={held} />);
  fireEvent.click(screen.getByRole('button', { name: 'Compare the two' }));
  expect(screen.getByRole('heading', { name: 'Which would you rather watch?' })).toBeVisible();
  rerender(<PickContender current={current} held={null} />);
  rerender(<PickContender current={current} held={{ primary: { id: 3, title: 'New option' } }} />);
  expect(screen.getByRole('button', { name: 'Compare the two' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('heading', { name: 'Which would you rather watch?' })).not.toBeInTheDocument();
});
test('changing identity clears only the held option without remounting children', () => {
  let mounts = 0;
  function Child() {
    React.useEffect(() => { mounts += 1; }, []);
    const [held, setHeld] = useHomeContender();
    return <button onClick={() => setHeld({ primary: { title: 'Held' } })}>{held?.primary.title || 'Keep'}</button>;
  }
  const { rerender } = render(<HomeContenderProvider identity="guest"><Child /></HomeContenderProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
  rerender(<HomeContenderProvider identity="signed-in"><Child /></HomeContenderProvider>);
  expect(screen.getByRole('button', { name: 'Keep' })).toBeVisible();
  expect(mounts).toBe(1);
});
test('keep, remove and return restore focus to the remaining action', async () => {
  function Harness() {
    const [current, setCurrent] = React.useState({ primary: { id: 2, title: 'Current' } });
    const [held, setHeld] = React.useState(null);
    return <><button onClick={() => setCurrent({ primary: { id: 3, title: 'Next' } })}>Next fixture</button><PickContender current={current} held={held} onKeep={() => setHeld(current)} onRemove={() => setHeld(null)} onReturn={() => { setCurrent(held); setHeld(current); }} /></>;
  }
  render(<Harness />);
  const { waitFor } = require('@testing-library/react');
  screen.getByRole('button', { name: 'Keep this option' }).focus();
  fireEvent.click(document.activeElement);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Current as an option' })).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Next fixture' }));
  fireEvent.click(screen.getByRole('button', { name: 'Compare the two' }));
  screen.getByRole('button', { name: 'Return to Current' }).focus();
  fireEvent.click(document.activeElement);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Compare the two' })).toHaveFocus());
  screen.getByRole('button', { name: 'Remove Next as an option' }).focus();
  fireEvent.click(document.activeElement);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Keep this option' })).toHaveFocus());
});
