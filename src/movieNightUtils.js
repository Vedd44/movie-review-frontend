// Shared links contain movie IDs and an optional choice, never prompts or taste history.
export function parseMovieNight(search) {
  const params = new URLSearchParams(search);
  const ids = [...new Set((params.get('movies') || '').split(',').filter(value => /^\d+$/.test(value)).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 3);
  const requestedChoice = Number(params.get('choice'));
  return { ids, choice: ids.includes(requestedChoice) ? requestedChoice : null };
}
export function movieNightPath(movies, choice = null) {
  const ids = [...new Set(movies.map(movie => Number(movie.id)).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 3);
  const params = new URLSearchParams({ movies: ids.join(',') });
  if (ids.includes(choice)) params.set('choice', String(choice));
  return `/movie-night?${params}`;
}
export async function shareMovieNight(url, text) {
  if (typeof navigator.share === 'function') {
    await navigator.share({ title: 'Our movie night · ReelBot', text, url });
    return 'Shared';
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'Link copied';
  }
  return 'Copy the link below to share it.';
}
