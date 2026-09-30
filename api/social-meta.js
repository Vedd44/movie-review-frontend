const fs = require("fs");
const path = require("path");
const ORIGIN = "https://reelbot.movie";
const API = "https://movie-review-backend-zevb.onrender.com";
const escapeHtml = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function collectionMeta(slug) {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "collections.js"), "utf8");
  const at = source.indexOf(`slug: "${slug}"`);
  if (at < 0) return null;
  const start = source.lastIndexOf("{", at);
  const end = source.indexOf("\n  },", at);
  const block = source.slice(start, end + 4);
  const pick = (key) => block.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1] || "";
  return { title: pick("title"), description: pick("description"), image: `${ORIGIN}/api/social-image?slug=${encodeURIComponent(slug)}` };
}

async function movieMeta(slug) {
  try {
    const response = await fetch(`${API}/movies/resolve/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const movie = await response.json();
    const year = movie.release_year || (movie.release_date || "").slice(0,4);
    return {
      title: `${movie.title}${year ? ` (${year})` : ""}`,
      description: movie.description || `Decide whether ${movie.title} is right for you, see where to watch, and find similar movies.`,
      image: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : `${ORIGIN}/brand/reelbot-social.png`,
    };
  } catch { return null; }
}

module.exports = async (req, res) => {
  const pagePath = String(req.query.path || "/");
  let meta = null;
  const collectionMatch = pagePath.match(/^\/collections\/([^/?#]+)/);
  const movieMatch = pagePath.match(/^\/movies\/([^/?#]+)/);
  if (collectionMatch) meta = collectionMeta(decodeURIComponent(collectionMatch[1]));
  else if (movieMatch) meta = await movieMeta(decodeURIComponent(movieMatch[1]));

  if (!meta) {
    meta = {
      title: "ReelBot — Find Something Worth Watching",
      description: "Get one tailored movie pick, useful backups, and a faster way to decide what to watch.",
      image: `${ORIGIN}/brand/reelbot-social.png`,
    };
  }
  const url = `${ORIGIN}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  const title = meta.title.includes("ReelBot") ? meta.title : `${meta.title} | ReelBot`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).send(`<!doctype html><html><head>
<meta charset="utf-8"><title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<meta property="og:site_name" content="ReelBot"><meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${escapeHtml(url)}"><meta property="og:image" content="${escapeHtml(meta.image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}"><meta name="twitter:image" content="${escapeHtml(meta.image)}">
<link rel="canonical" href="${escapeHtml(url)}">
<script>window.location.replace(${JSON.stringify(url)});</script></head><body><p>Opening <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>…</p></body></html>`);
};
