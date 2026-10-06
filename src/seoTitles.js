// Keep crawler HTML and hydrated pages consistent. Preserve the complete name
// in the H1; shorten search titles only after dropping optional suffixes.
const LIMIT = 60;
const compactTitle = (primary, suffixes = [' | ReelBot']) => {
  primary = String(primary || '').trim();
  for (const suffix of suffixes) if ((primary + suffix).length <= LIMIT) return primary + suffix;
  if (primary.length <= LIMIT) return primary;
  const clipped = primary.slice(0, LIMIT - 1);
  const boundary = clipped.lastIndexOf(' ');
  return (boundary > LIMIT * 0.65 ? clipped.slice(0, boundary) : clipped).trimEnd() + '…';
};
const movieTitle = (name, year) => compactTitle(`${name}${year ? ` (${year})` : ''}`, [': Cast & Where to Watch | ReelBot', ' | ReelBot']);
const personTitle = name => compactTitle(name, [' Movies & Filmography | ReelBot', ' Filmography | ReelBot', ' | ReelBot']);
const collectionTitle = name => compactTitle(name, [' | ReelBot Collections', ' | ReelBot']);
module.exports = {compactTitle, movieTitle, personTitle, collectionTitle};
