const {movieTitle, personTitle, collectionTitle} = require('../src/seoTitles');
const personDescription = require('../src/personDescription');
const copy = require('../src/productCopy');
const { getFeaturedCollections, getNextFeaturedBoundary } = require('../src/featuredCollections');
const legalCopy = require('../src/legalCopy.json');
const { parseSharedPick } = require('../src/sharedPick');
const ORIGIN = 'https://reelbot.movie';
const API = 'https://movie-review-backend-zevb.onrender.com';
const DEFAULT_IMAGE = `${ORIGIN}/brand/reelbot-social.png`;
const moviePath = (movie) => `/movies/${movie.canonical_slug || movie.slug || ''}`;
const personPath = (person) => person.canonical_path || `/people/${person.canonical_slug}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (href, label) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
const breadcrumbs = (items) => ({ '@context':'https://schema.org', '@type':'BreadcrumbList', itemListElement: items.map(([name,path],i)=>({'@type':'ListItem',position:i+1,name,item:ORIGIN+path})) });
const itemList = (movies) => ({ '@context':'https://schema.org', '@type':'ItemList', itemListElement: movies.map((m,i)=>({'@type':'ListItem', position:i+1, name:m.title, url:ORIGIN+moviePath(m)})) });
const movieLinks = (movies) => `<ul>${movies.map(m=>`<li>${link(moviePath(m), m.title)}${m.release_date ? ` (${escapeHtml(m.release_date.slice(0,4))})` : ''}</li>`).join('')}</ul>`;
const missing = (path) => ({status:404,path,title:'Page not found | ReelBot',description:'This page could not be found. Explore movies and collections on ReelBot.',robots:'noindex,follow',heading:'Page not found'});
async function apiJson(endpoint, fetcher) {
  const signal = AbortSignal.timeout(12000);
  let response;
  // Brief metadata contention should not turn a crawlable page into an error.
  // Honor only short Retry-After delays within the existing request deadline.
  for (let attempt = 0; ; attempt++) {
    response = await fetcher(API+endpoint, {signal});
    const header = response.headers?.get('retry-after');
    const retryAfter = /^\d+$/.test(header || '') ? Number(header) : 1;
    if (response.status !== 429 || !endpoint.includes('view=metadata') || attempt >= 2 || retryAfter > 2) break;
    await response.body?.cancel?.();
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    signal.throwIfAborted();
  }
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) {
    const error = new Error(`Movie data unavailable (${response.status})`);
    error.status = response.status === 429 ? 429 : 503;
    error.retryAfter = /^\d+$/.test(response.headers?.get('retry-after') || '') ? response.headers.get('retry-after') : '60';
    throw error;
  }
  return response.json();
}
const STATIC = {
  '/': [copy.title,'What should I watch?',copy.description],
  '/browse': ['Browse Movies | ReelBot','Browse Movies','Browse movies currently playing, trending, and coming soon, then ask ReelBot to narrow the choice.'],
  '/now-playing': ['Now Playing Movies | ReelBot','Now Playing','Explore movies in theaters now, with cast, runtime and where-to-watch details.'],
  '/trending': ['Trending Movies | ReelBot','Trending Movies','Discover popular movies, explore their cast and find your next watch.'],
  '/coming-soon': ['Upcoming Movies & New Releases | ReelBot','Coming Soon','Explore upcoming movie releases, trailers, cast and release dates.'],
  '/how-reelbot-works': [copy.howTitle,'How ReelBot works',copy.howIntro],
  '/movie-night': ['Choose a Movie Together | ReelBot','Your movie night','Choose from a few ReelBot picks and share your choice.'],
  '/my-movies': ['My Movies | ReelBot','My Movies','Your saved movies and recent picks.'],
  '/account': ['Account | ReelBot','Your account','Manage your ReelBot account.'],
  '/admin': ['Administration | ReelBot','Administration','ReelBot administration.'],
  '/reset-password': ['Reset Password | ReelBot','Reset your password','Reset your ReelBot password.'],
  '/search': ['Search | ReelBot','Search movies','Search movies by title, actor, franchise or director.'],
};
async function getPageData(rawPath, params = new URLSearchParams(), {collections=[], movies={}, fetcher=fetch, now=Date.now(), featuredMode="seasonal"} = {}) {
  let path;
  try { path = decodeURIComponent(rawPath); } catch { return missing('/404'); }
  if (!path.startsWith('/') || path.startsWith('//') || /[<>\x00-\x1f?#]/.test(path)) return missing('/404');
  if (path.length > 1 && path.endsWith('/')) return {redirect:path.replace(/\/+$/, '')};
  const legal = Object.values(legalCopy).find(page => page.path === path);
  if (legal) return {path, title: `${legal.title} | ReelBot`, heading: legal.title, description: legal.description, content: `<p>Updated ${escapeHtml(legal.updated)}</p>` + legal.sections.map(([heading,...paragraphs]) => `<section><h2>${escapeHtml(heading)}</h2>${paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</section>`).join('') + `<p>${link('/privacy','Privacy Policy')} · ${link('/terms','Terms of Service')}</p>`};
  if (path === '/ask') return {redirect:'/#pick-for-me'};
  if (path === '/' && params.has('view')) return {redirect: ({popular:'/trending',upcoming:'/coming-soon'})[params.get('view')] || '/now-playing'};
  const shortShare = path.match(/^\/p\/([A-Za-z0-9_-]{12})$/);
  if (shortShare) {
    const shared = await apiJson(`/reelbot/shares/${shortShare[1]}`,fetcher);
    if (!shared || !parseSharedPick(new URLSearchParams({pick:JSON.stringify(shared)}).toString())) return missing(path);
    const movie = await apiJson(`/movies/${shared.id}?view=metadata`,fetcher);
    if (!movie?.id) return missing(path);
    return {path,title:`ReelBot’s pick: ${movie.title} | ReelBot`,heading:movie.title,
      description:shared.brief ? `Picked by ReelBot for: ${shared.brief}` : 'A movie worth making time for. Picked by ReelBot.',robots:'noindex,follow',privatePage:true,
      image:`${ORIGIN}/api/pick-image?movie=${movie.id}&v=3`,content:`<p>ReelBot’s pick</p>${shared.brief ? `<h2>The request</h2><p>${escapeHtml(shared.brief)}</p>` : ''}<h2>Why ReelBot chose it</h2><p>${escapeHtml(shared.why)}</p><p>${link(moviePath(movie),'Full movie details')} ${link('/#pick-for-me','Find your own movie')}</p>`};
  }
  if (path.startsWith('/p/')) return missing(path);
  if (STATIC[path]) {
    const [title,heading,description] = STATIC[path];
    const privatePage = ['/my-movies','/account','/admin','/reset-password','/search','/movie-night'].includes(path);
    const filtered = path === '/browse' && ['view','genre','mood','runtime'].some(k=>params.has(k) && !['all','any','popular'].includes(params.get(k)));
    const page = Math.min(500, Math.max(1, parseInt(params.get('page'),10) || 1));
    const isFeed = ['/browse','/now-playing','/trending','/coming-soon'].includes(path);
    const canonicalPath = isFeed && !filtered && page > 1 ? `${path}?page=${page}` : path;
    const data = {path:canonicalPath,title: page > 1 && isFeed ? `${heading} — Page ${page} | ReelBot` : title,heading,description,robots: privatePage || filtered ? 'noindex,follow' : 'index,follow',privatePage};
    if (['/','/browse','/now-playing','/trending','/coming-soon'].includes(path)) {
      const type = ({'/':'popular','/now-playing':'latest','/coming-soon':'upcoming'})[path] || 'popular';
      const payload = await apiJson(`/movies?type=${type}&page=${isFeed ? page : 1}`,fetcher);
      const feed = (payload?.results || []).map(m=>({...m,canonical_slug:m.canonical_slug || `${String(m.title).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}${m.release_date ? '-'+m.release_date.slice(0,4) : ''}`}));
      data.content = movieLinks(feed.slice(0,20));
      if (isFeed && page < (payload?.total_pages || 1)) data.content += link(`${path}?page=${page+1}`,'Next page');
      if (path === '/') {
        const featured = getFeaturedCollections(collections, now, featuredMode);
        data.content += `<h2>${escapeHtml(featured.heading)}</h2><p>${escapeHtml(featured.description)}</p><ul>` + featured.collections.map(c=>`<li>${link('/collections/'+c.slug,c.title)}${featured.notes[c.slug] ? `<p>${escapeHtml(featured.notes[c.slug])}</p>` : ''}</li>`).join('')+'</ul>' + link('/collections', 'View all collections');
        // Never let a cached homepage carry this campaign past its boundary.
        const boundary = getNextFeaturedBoundary(now);
        const untilBoundary = boundary === null ? Infinity : Math.max(0, Math.floor((boundary - Number(now)) / 1000));
        data.cacheMaxAgeSeconds = Math.min(3600, untilBoundary);
        data.cacheStaleSeconds = Math.min(86400, untilBoundary - data.cacheMaxAgeSeconds);
      }
    }
    if (path === '/') {
      data.content = `<p>${escapeHtml(copy.intro)}</p><p>Try a mood, a movie you love, or how much time you have.</p>` + data.content;
      data.schema = [
        {'@context':'https://schema.org','@type':'Organization',name:'ReelBot',url:ORIGIN+'/',description:copy.description,logo:ORIGIN+'/brand/reelbot-logo.svg'},
        {'@context':'https://schema.org','@type':'WebSite',name:'ReelBot',url:ORIGIN+'/'},
        {'@context':'https://schema.org','@type':'WebApplication',name:'ReelBot',url:ORIGIN+'/',applicationCategory:'EntertainmentApplication',operatingSystem:'Web',description:copy.description}
      ];
    }
    if (path === '/how-reelbot-works') data.content = '<h2>Get a recommendation</h2><ol>'+copy.steps.map(([title,text])=>`<li><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></li>`).join('')+'</ol><h2>Make it yours</h2><p>Save movies for later. Mark movies Watched or Not for me to keep them out of future picks. Ask follow-up questions about a movie or recommendation.</p>'+`<h2>${escapeHtml(copy.faqQuestion)}</h2><p>${escapeHtml(copy.faqAnswer)}</p><h2>Where the movie data comes from</h2><p>${escapeHtml(copy.ai)}</p>`;
    return data;
  }
  if (path === '/collections') return {path,title:'Movie Collections by Mood, Genre & More | ReelBot',heading:'Find your next movie.',description:'Handpicked movie collections for every mood, genre, era, and kind of movie night.',content:'<ul>'+collections.map(c=>`<li>${link('/collections/'+c.slug,c.title)}<p>${escapeHtml(c.description)}</p></li>`).join('')+'</ul>'};
  const collectionMatch = path.match(/^\/collections\/([^/]+)$/);
  if (collectionMatch) {
    const c = collections.find(c=>c.slug===collectionMatch[1]);
    if (!c) return missing(path);
    const entries = c.movies.filter(slug=>slug!==c.anchorMovie).map(slug=>movies[slug]).filter(Boolean);
    return {path,title:collectionTitle(c.title),heading:c.title,description:c.description,image:`${ORIGIN}/social/collections/${c.slug}-v5.jpg`,content:movieLinks(entries),schema:[breadcrumbs([['Home','/'],['Collections','/collections'],[c.title,path]]),itemList(entries)]};
  }
  const numericMovie = path.match(/^\/(?:movie|movies)\/(\d+)(?:\/[^/]+)?$/);
  const movieMatch = path.match(/^\/movies\/([^/]+)$/);
  if (numericMovie || movieMatch) {
    const knownId = numericMovie?.[1] || movies[movieMatch?.[1]]?.id;
    const m = await apiJson(knownId ? `/movies/${knownId}?view=metadata` : `/movies/resolve/${encodeURIComponent(movieMatch[1])}?view=metadata`,fetcher);
    if (!m?.id || !m.canonical_slug) return missing(path);
    const canonicalPath = moviePath(m);
    if (path !== canonicalPath) return {redirect:canonicalPath};
    const shared = parseSharedPick(params.toString(), m.id);
    if (shared) return {path: `${path}?${new URLSearchParams({pick: JSON.stringify(shared)})}`, title: `ReelBot’s pick: ${m.title} | ReelBot`, heading:m.title,
      description:shared.brief ? `Picked by ReelBot for: ${shared.brief}` : 'A movie worth making time for. Picked by ReelBot.', robots:'noindex,follow', privatePage:true,
      image:`${ORIGIN}/api/pick-image?movie=${m.id}&v=3`, content:`<p>Picked by ReelBot</p>${shared.brief ? `<h2>The brief</h2><p>${escapeHtml(shared.brief)}</p>` : ''}${shared.why ? `<h2>Why this fits</h2><p>${escapeHtml(shared.why)}</p>` : ''}<p>${link(path,'Movie details')}. ${link('/#pick-for-me','Find your own movie')}</p>`};
    const year = m.release_year || m.release_date?.slice(0,4);
    const title = movieTitle(m.title, year);
    const description = `Explore ${m.title}${year ? ` (${year})` : ''}, including ReelBot’s take, cast, runtime, where to watch, and similar movies worth adding to your list.`;
    const facts = [year,m.runtime ? `${m.runtime} min` : '',m.certification,...(m.genre_names || []),m.rating ? `TMDB ${Number(m.rating).toFixed(1)}/10` : ''].filter(Boolean).join(' · ');
    return {path,title,heading:m.title,description,type:'video.movie',image:m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : DEFAULT_IMAGE,
      content:`<p>${escapeHtml(facts)}</p><h2>Overview</h2><p>${escapeHtml(m.description || '')}</p>`+((m.director_credit?.canonical_slug || m.director_credit?.canonical_path) ? `<p>Directed by ${link(personPath(m.director_credit),m.director_credit.name)}</p>` : '')+'<h2>Cast</h2><ul>'+(m.top_cast_credits || []).filter(p=>p.canonical_slug || p.canonical_path).map(p=>`<li>${link(personPath(p),p.name)}${p.character ? ` — ${escapeHtml(p.character)}` : ''}</li>`).join('')+'</ul>',
      schema:[breadcrumbs([['Home','/'],['Browse','/browse'],[m.title,path]]),{'@context':'https://schema.org','@type':'Movie',name:m.title,url:ORIGIN+path,description:m.description || undefined,image:m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,datePublished:m.release_date || undefined,duration:m.runtime ? `PT${m.runtime}M` : undefined,contentRating:m.certification || undefined,genre:m.genre_names,director:m.director ? {'@type':'Person',name:m.director} : undefined,actor:(m.top_cast || []).map(name=>({'@type':'Person',name}))}]};
  }
  const numericPerson = path.match(/^\/person\/(\d+)$/);
  const personMatch = path.match(/^\/people\/([^/]+)$/);
  if (numericPerson || personMatch) {
    const person = await apiJson(numericPerson ? `/person/${numericPerson[1]}?view=metadata` : `/people/resolve/${encodeURIComponent(personMatch[1])}?view=metadata`,fetcher);
    if (!person?.id || !person.canonical_slug) return missing(path);
    if (path !== personPath(person)) return {redirect:personPath(person)};
    const description = personDescription(person.name);
    return {path,title:personTitle(person.name),heading:person.name,description,type:'profile',image:person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : DEFAULT_IMAGE,content:`<p>${escapeHtml(person.known_for_department || '')}</p><p>${escapeHtml(person.biography || '')}</p><h2>Filmography</h2>`+movieLinks((person.movie_credits || []).map(m=>({...m,canonical_slug:m.canonical_slug || m.slug || `${String(m.title).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}${m.release_date ? '-'+m.release_date.slice(0,4) : ''}`}))),schema:[breadcrumbs([['Home','/'],[person.name,path]]),{'@context':'https://schema.org','@type':'Person',name:person.name,url:ORIGIN+path,description:person.biography || undefined,jobTitle:person.known_for_department || undefined}]};
  }
  return missing(path);
}
function renderPage(shell, data) {
  const canonical = ORIGIN+data.path;
  const image = data.image || DEFAULT_IMAGE;
  const tags = [
    `<title>${escapeHtml(data.title)}</title>`,
    `<meta name="description" content="${escapeHtml(data.description)}">`,
    `<meta name="robots" content="${escapeHtml(data.robots || 'index,follow')}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    ...Object.entries({'og:site_name':'ReelBot','og:type':data.type || 'website','og:title':data.title,'og:description':data.description,'og:url':canonical,'og:image':image,'og:image:alt':data.heading}).map(([k,v])=>`<meta property="${k}" content="${escapeHtml(v)}">`),
    ...Object.entries({'twitter:card':'summary_large_image','twitter:title':data.title,'twitter:description':data.description,'twitter:image':image}).map(([k,v])=>`<meta name="${k}" content="${escapeHtml(v)}">`),
    ...(data.schema || []).map((schema,i)=>`<script type="application/ld+json" data-reelbot-schema="${i}">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>`),
  ].join('');
  const content = `<main class="server-page"><nav aria-label="Primary">${link('/','ReelBot')}${link('/browse','Browse')}${link('/collections','Collections')}</nav><h1>${escapeHtml(data.heading)}</h1><p>${escapeHtml(data.description)}</p>${data.content || ''}<footer>${link('/privacy','Privacy Policy')} ${link('/terms','Terms of Service')}</footer></main>`;
  return shell.replace(/<title>[\s\S]*?<\/title>/i,'').replace(/<meta\s[^>]*(?:name="(?:description|robots|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/gi,'').replace(/<link\s[^>]*rel="canonical"[^>]*>/gi,'').replace('</head>',tags+'</head>').replace(/<div id="root">[\s\S]*<\/div>\s*<\/body>/,`<div id="root">${content}</div></body>`);
}
module.exports = {getPageData,renderPage,escapeHtml,moviePath};
