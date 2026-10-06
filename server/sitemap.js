const ORIGIN = 'https://reelbot.movie';
const CORE_PATHS = ['/', '/browse', '/now-playing', '/trending', '/coming-soon', '/how-reelbot-works', '/collections', '/privacy', '/terms'];
const escapeXml = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[c]));
function canonicalPath(value) {
  try {
    const url = new URL(value, ORIGIN);
    if(url.origin !== ORIGIN || url.search || url.hash || url.username || url.password) return null;
    if(CORE_PATHS.includes(url.pathname) || /^\/(?:movies|people|collections)\/[a-z0-9]+(?:-+[a-z0-9]+)*$/.test(url.pathname)) return url.pathname;
  } catch {}
  return null;
}
function buildSitemap(paths) {
  const canonical = [...new Set([...CORE_PATHS,...paths].map(canonicalPath).filter(Boolean))].sort();
  if(canonical.length > 50000) throw Error('Split the sitemap before exceeding 50,000 URLs');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + canonical.map(p => `  <url><loc>${escapeXml(ORIGIN+p)}</loc></url>`).join('\n') + '\n</urlset>\n';
}
function discoveryPaths(xml) {
  if(!/<urlset\b/.test(xml) || !/<\/urlset>\s*$/.test(xml)) throw Error('Invalid discovery sitemap');
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)].map(match=>canonicalPath(match[1].trim())).filter(Boolean);
}
async function fetchDiscoveryPaths(fetcher=fetch) {
  try {
    const response=await fetcher('https://movie-review-backend-zevb.onrender.com/sitemap.xml',{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error(`HTTP ${response.status}`);
    const xml=await response.text();
    if(xml.length>5*1024*1024) throw Error('Discovery sitemap is too large');
    return discoveryPaths(xml);
  } catch(error) {
    console.warn(`Discovery refresh unavailable (${error.message}); publishing saved discovery and curated URLs.`);
    return [];
  }
}
module.exports={CORE_PATHS,canonicalPath,buildSitemap,discoveryPaths,fetchDiscoveryPaths};
