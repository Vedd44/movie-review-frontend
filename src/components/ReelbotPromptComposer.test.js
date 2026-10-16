import { fireEvent, render, screen } from '@testing-library/react';
import ReelbotPromptComposer from './ReelbotPromptComposer';

const suggestions = ['Big and cinematic', 'Smart but easy', 'A great thriller', 'Critically loved'];
test('optional phone disclosure tracks expanded state and keeps all presets available', () => {
  const onSuggestionSelect = jest.fn();
  const { rerender } = render(<ReelbotPromptComposer collapseSuggestionsOnMobile suggestions={suggestions} value="" onSuggestionSelect={onSuggestionSelect} />);
  const toggle = screen.getByRole('button', { name: 'Try a suggestion' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  // Verify the disclosure's ARIA relationship to its actual controlled panel.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.getElementById(toggle.getAttribute('aria-controls'))).toHaveClass('pick-prompt-suggestions--collapsible');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  suggestions.forEach(prompt => {
    fireEvent.click(screen.getByRole('button', { name: prompt }));
    expect(onSuggestionSelect).toHaveBeenLastCalledWith(prompt);
  });
  rerender(<ReelbotPromptComposer collapseSuggestionsOnMobile suggestions={suggestions} value={suggestions[0]} activeSuggestion={suggestions[0]} onSuggestionSelect={onSuggestionSelect} />);
  fireEvent.click(screen.getByRole('button', { name: `Suggestion: ${suggestions[0]}` }));
  expect(screen.getByRole('button', { name: `Suggestion: ${suggestions[0]}` })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('textbox')).toHaveValue(suggestions[0]);
});
test('other composer instances retain the plain suggestion list without a disclosure', () => {
  render(<ReelbotPromptComposer suggestions={suggestions} value="" />);
  expect(screen.queryByRole('button', { name: 'Try a suggestion' })).not.toBeInTheDocument();
  suggestions.forEach(prompt => expect(screen.getByRole('button', { name: prompt })).toBeInTheDocument());
});
