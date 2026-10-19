import { reviewExcerptText, reviewSourceUrl } from './reviewPresentation';

test.each([
  ['<em>Fargo</em> is <strong>excellent</strong>.', 'Fargo is excellent.'],
  ['<p>First.</p><p>Second<br>line.</p>', 'First. Second line.'],
  ['Tom &amp; Jerry &#8217; &#x2014; &quot;great&quot;', 'Tom & Jerry ’ — "great"'],
  ['I rate it < 3 but > 1.', 'I rate it < 3 but > 1.'],
  ['<script>alert(1)</script>Safe<style>bad</style>', 'Safe'],
  ['<!-- comment -->Fine<img src="https://bad.invalid/x">', 'Fine'],
  [null, ''],
  ['&#0; &#xD800; &#1114112;', '&#0; &#xD800; &#1114112;'],
])('normalizes display text without interpreting HTML: %s', (input, expected) => {
  expect(reviewExcerptText(input)).toBe(expected);
});

test('preserves escaped angle brackets as text, not HTML', () => {
  expect(reviewExcerptText('&lt;img src=x onerror=alert(1)&gt;')).toBe('<img src=x onerror=alert(1)>');
});

const original = 'https://www.themoviedb.org/review/5e0000000000000000000001';
test('retains an original TMDB review link without constructing one', () => {
  expect(reviewSourceUrl(original)).toBe(original);
});

test.each([
  undefined, '', 'javascript:alert(1)', 'http://www.themoviedb.org/review/5e0000000000000000000001',
  'https://themoviedb.org.evil.invalid/review/5e0000000000000000000001',
  'https://evil.invalid/review/5e0000000000000000000001',
  'https://person:password@www.themoviedb.org/review/5e0000000000000000000001',
  `${original}?redirect=https://evil.invalid`, `${original}#fragment`,
  'https://www.themoviedb.org/movie/275-fargo', '/review/5e0000000000000000000001',
])('omits unsupported or unsafe source URLs: %s', (value) => expect(reviewSourceUrl(value)).toBeNull());
