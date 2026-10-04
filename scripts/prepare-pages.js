const fs = require('node:fs');
const path = require('node:path');
const {readCollections} = require('../server/collections');
const {escapeHtml, getPageData, renderPage} = require('../server/pageData');
const collections = readCollections();
const movies = require('../src/generatedCollectionMovies.json');
const out = path.join(__dirname,'../server/generated');
fs.mkdirSync(out,{recursive:true});
fs.copyFileSync(path.join(__dirname,'../build/index.html'),path.join(out,'shell.html'));
fs.writeFileSync(path.join(out,'collections.json'),JSON.stringify(collections));
fs.writeFileSync(path.join(out,'movies.json'),JSON.stringify(movies));
const paths = new Set(['/privacy','/terms','/collections',...collections.map(c=>'/collections/'+c.slug),...Object.values(movies).filter(m=>m.canonical_slug).map(m=>'/movies/'+m.canonical_slug)]);
for (const movie of Object.values(movies)) for (const person of [movie.director_credit,...(movie.top_cast_credits || [])]) if(person?.canonical_slug) paths.add('/people/'+person.canonical_slug);
fs.writeFileSync('build/sitemap-curated.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...paths].sort().map(p=>`<url><loc>https://reelbot.movie${escapeHtml(p)}</loc></url>`).join('')+'</urlset>');
fs.writeFileSync('build/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://reelbot.movie/sitemap-curated.xml</loc></sitemap><sitemap><loc>https://reelbot.movie/sitemap-discovery.xml</loc></sitemap></sitemapindex>');
console.log(`Prepared page documents and sitemap: ${collections.length} collections, ${paths.size} curated URLs.`);

// Vercel serves the root index before fallback rewrites. Publish the homepage
// document at build time, while detail routes use the cached page function.
getPageData('/', new URLSearchParams(), {collections, movies})
  .then((data) => {
    const shell = fs.readFileSync(path.join(out, 'shell.html'), 'utf8');
    fs.writeFileSync('build/index.html', renderPage(shell, data));
    console.log('Prepared the static homepage document.');
  })
  .catch((error) => {
    console.error('Unable to prepare homepage:', error.message);
    process.exitCode = 1;
  });
