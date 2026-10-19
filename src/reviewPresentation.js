// These API slots are rating-based samples, not sentiment classifications.
// Keep review selection on the server; only format its supplied excerpts here.
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export const reviewExcerptText = (value) => {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<\/?(?:p|div|br|li|ul|ol|blockquote|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
      const codePoint = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
        ? String.fromCodePoint(codePoint) : entity;
    });
  // This is display text, never HTML. React must continue escaping the result.
  return text.replace(/\s+/g, ' ').trim();
};

export const reviewSourceUrl = (value) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['www.themoviedb.org', 'themoviedb.org'].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || !/^\/review\/[a-f0-9]{24}\/?$/i.test(url.pathname)) return null;
    return value;
  } catch {
    return null;
  }
};
