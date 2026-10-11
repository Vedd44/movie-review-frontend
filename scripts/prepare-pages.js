const fs = require('node:fs');
const path = require('node:path');
const {buildSitemap,fetchDiscoveryPaths} = require('../server/sitemap');
const discoverySnapshot = require('../src/generatedDiscoveryPaths.json');
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
// Vercel serves the root index before fallback rewrites. Publish the homepage
// document at build time, while detail routes use the cached page function.
// Static HTML deliberately stays evergreen: it cannot expire at a calendar boundary.
// The client selects the current editorial shelf from the same collection selector.
Promise.all([getPageData('/', new URLSearchParams(), {collections, movies, featuredMode: "evergreen"}), fetchDiscoveryPaths()])
  .then(([data, freshDiscoveryPaths]) => {
    const discovery = [...discoverySnapshot, ...freshDiscoveryPaths];
    fs.writeFileSync('build/sitemap-curated.xml', buildSitemap(paths));
    fs.writeFileSync('build/sitemap-discovery.xml', buildSitemap(discovery));
    // A flat, static sitemap removes child-fetch and request-time API dependencies.
    fs.writeFileSync('build/sitemap.xml', buildSitemap([...paths,...discovery]));
    console.log(`Prepared static sitemaps: ${paths.size} curated URLs, ${new Set(discovery).size} discovery URLs.`);
    const shell = fs.readFileSync(path.join(out, 'shell.html'), 'utf8');
    fs.writeFileSync('build/index.html', renderPage(shell, data));
    console.log('Prepared the static homepage document.');
  })
  .catch((error) => {
    console.error('Unable to prepare homepage:', error.message);
    process.exitCode = 1;
  });
