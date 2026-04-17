import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the ReelBot tagline', () => {
  render(<App />);
  const taglines = screen.getAllByText(/Find something worth watching/i);
  expect(taglines.length).toBeGreaterThan(0);
});
