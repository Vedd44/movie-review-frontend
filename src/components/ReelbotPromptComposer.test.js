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

test('a separate primary action can keep keyboard submission without a duplicate arrow', () => {
  const onSubmit = jest.fn();
  const onChange = jest.fn();
  const { rerender } = render(<ReelbotPromptComposer value="" onSubmit={onSubmit} onChange={onChange} showSubmitButton={false} allowEmptySubmit />);
  expect(screen.queryByRole('button', { name: 'Submit prompt' })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  rerender(<ReelbotPromptComposer value="A great thriller" onSubmit={onSubmit} onChange={onChange} showSubmitButton={false} allowEmptySubmit />);
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(onSubmit).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Clear prompt' }));
  expect(onChange).toHaveBeenCalledWith('');
  rerender(<ReelbotPromptComposer value="A great thriller" onSubmit={onSubmit} showSubmitButton={false} allowEmptySubmit submitDisabled />);
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(onSubmit).toHaveBeenCalledTimes(2);
});

test('existing composers still require text and retain their submit arrow', () => {
  const onSubmit = jest.fn();
  const { rerender } = render(<ReelbotPromptComposer value="" onSubmit={onSubmit} />);
  expect(screen.getByRole('button', { name: 'Submit prompt' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
  rerender(<ReelbotPromptComposer value="A great thriller" onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Submit prompt' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
