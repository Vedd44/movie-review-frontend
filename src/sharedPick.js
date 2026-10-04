// A share is an immutable, bounded snapshot. No profile, account or history is included.
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function parseSharedPick(search, movieId) {
  try {
    const raw = new URLSearchParams(search).get('pick');
    if (!raw || raw.length > 6000) return null;
    const data = JSON.parse(raw);
    if (data.v !== 1 || !Number.isSafeInteger(data.id) || data.id <= 0 || (movieId && data.id !== Number(movieId))) return null;
    return { v: 1, id: data.id, why: text(data.why, 1200), brief: text(data.brief, 500) };
  } catch { return null; }
}
function sharedPickQuery(movie, why, brief = '') {
  return new URLSearchParams({ pick: JSON.stringify({v:1, id:Number(movie.id), why:text(why,1200), brief:text(brief,500)}) }).toString();
}
module.exports = { parseSharedPick, sharedPickQuery };
