const { safeUrl } = require('../src/news/policy');
const API = 'https://movie-review-backend-zevb.onrender.com/movie-news';
function publicSnapshot(value) {
  if (value?.version !== 1 || !Array.isArray(value.items)) throw new Error('Invalid news snapshot');
  return { version: 1, updatedAt: Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null,
    items: value.items.filter(item => item && !item.synthetic && safeUrl(item.sourceUrl) &&
      ['id', 'headline', 'summary', 'take', 'sourceName'].every(key => typeof item[key] === 'string') &&
      Number.isFinite(Date.parse(item.publishedAt))).slice(0, 25).map(item => ({
        id: item.id, headline: item.headline, summary: item.summary, take: item.take,
        sourceName: item.sourceName, sourceUrl: item.sourceUrl, publishedAt: item.publishedAt,
        editorialReviewedAt: item.editorialReviewedAt || null, author: typeof item.author === 'string' ? item.author : '',
      })) };
}
function createHandler(fetcher = fetch) {
 return async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return res.status(405).json({error:'Method not allowed'}); }
  try {
   const response = await fetcher(API, {signal: AbortSignal.timeout(6500)});
   if (!response.ok) throw new Error('News unavailable');
   const snapshot = publicSnapshot(await response.json());
   res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400');
   if (req.method === 'HEAD') return res.status(200).end();
   return res.status(200).json(snapshot);
  } catch {
   res.setHeader('Cache-Control', 'no-store');
   return res.status(503).json({error:'Movie news is temporarily unavailable'});
  }
 };
}
module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.publicSnapshot = publicSnapshot;
