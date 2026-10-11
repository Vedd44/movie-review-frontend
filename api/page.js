const fs = require('node:fs');
const path = require('node:path');
const { getPageData, renderPage } = require('../server/pageData');
const generated = path.join(process.cwd(), 'server/generated');
module.exports = async (req, res) => {
  const shell = fs.readFileSync(path.join(generated,'shell.html'),'utf8');
  const params = new URL(req.url,'https://reelbot.movie').searchParams;
  const pagePath = String(req.query.path || '/');
  try {
    const data = await getPageData(pagePath,params,{
      collections: JSON.parse(fs.readFileSync(path.join(generated,'collections.json'),'utf8')),
      movies: JSON.parse(fs.readFileSync(path.join(generated,'movies.json'),'utf8')),
    });
    if (data.redirect) { res.setHeader('Location',data.redirect); res.setHeader('Cache-Control','public, max-age=300'); return res.status(308).end(); }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    const pageTtl = data.cacheMaxAgeSeconds ?? (data.status === 404 ? 300 : /^\/movies\//.test(data.path) ? 21600 : 3600);
    res.setHeader('Cache-Control',data.privatePage ? 'private, no-store' : `public, max-age=0, s-maxage=${pageTtl}, stale-while-revalidate=${data.cacheStaleSeconds ?? 86400}`);
    if (data.robots?.startsWith('noindex')) res.setHeader('X-Robots-Tag','noindex, follow');
    return res.status(data.status || 200).send(renderPage(shell,data));
  } catch (error) {
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Retry-After',error.retryAfter || '60');
    return res.status(error.status === 429 ? 429 : 503).send(renderPage(shell,{path:pagePath,title:'Temporarily unavailable | ReelBot',heading:'Movie details are taking a moment',description:'Please try again shortly.',robots:'noindex,follow'}));
  }
};
