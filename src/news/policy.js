const HOSTS = ['variety.com', 'deadline.com', 'www.hollywoodreporter.com', 'hollywoodreporter.com', 'www.indiewire.com', 'indiewire.com'];
function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && HOSTS.includes(url.hostname); } catch { return false; }
}
function isFreshStory(story, now = Date.now()) {
  const published = Date.parse(story?.publishedAt);
  return Number.isFinite(published) && published <= now + 300000 && now - published <= 7 * 86400000;
}
function isStale(snapshot, now = Date.now()) {
  const updated = Date.parse(snapshot?.updatedAt);
  return !Number.isFinite(updated) || updated > now + 300000 || now - updated > 48 * 3600000;
}
module.exports = { safeUrl, isFreshStory, isStale };
