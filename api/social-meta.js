const fs = require("fs");
const path = require("path");
const ORIGIN = "https://reelbot.movie";
const API = "https://movie-review-backend-zevb.onrender.com";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function readCollectionBlock(slug) {
  const source = fs.readFileSync(path.join(process.cwd(), "src", "collections.js"), "utf8");
  const marker = `slug: "${slug}"`;
  const at = source.indexOf(marker);
  if (at < 0) return null;
  const start = source.lastIndexOf("{", at);
  const nextEntry = source.indexOf('\n  {\n    slug: "', at + marker.length);
  const end = nextEntry >= 0 ? nextEntry : source.indexOf("\n];", at);
  return source.slice(start, end >= 0 ? end : source.length);
}

function pickString(block, key) {
  const match = block.match(new RegExp(`${key}\\s*:\\s*"([^"]*)"`));
  return match ? match[1] : "";
}

function collectionMeta(slug) {
  const block = readCollectionBlock(slug);
  if (!block) return null;
  const title = pickString(block, "title");
  const rawDescription = pickString(block, "description");
  if (!title) return null;
  const description = rawDescription.length >= 100
    ? rawDescription
    : `${rawDescription}${rawDescription ? " " : ""}Browse the full ReelBot collection and find your next movie.`;
  return {
    title,
    description,
    image: `${ORIGIN}/social/collections/${encodeURIComponent(slug)}-v3.jpg`,
  };
}

async function personMeta(slug) {\n  try {\n    const response = await fetch(`${API}/people/resolve/${encodeURIComponent(slug)}`);\n    if (!response.ok) return null;\n    const person = await response.json();\n    const name = person.name || \"\";\n    if (!name) return null;\n    const credits = Array.isArray(person.movie_credits) ? person.movie_credits : [];\n    const count = credits.filter((movie) => movie.release_date).length || credits.length;\n    return {\n      title: `${name} Movies & Filmography`,\n      description: `Explore ${name}'s movie filmography on ReelBot, including ${count || \"their\"} film credits, roles, release dates, ratings, and movie details.`,\n      image: person.profile_path ? `https://image.tmdb.org/t/p/h632${person.profile_path}` : `${ORIGIN}/brand/reelbot-social.png`,\n      imageAlt: `${name} filmography on ReelBot`,\n      type: \"profile\",\n    };\n  } catch { return null; }\n}\n\nasync function movieMeta(slug) {
  try {
    const response = await fetch(`${API}/movies/resolve/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const movie = await response.json();
    const year = movie.release_year || (movie.release_date || "").slice(0, 4);
    return {
      title: `${movie.title}${year ? ` (${year})` : \"\"}: Cast, Where to Watch & More`,
      description: `Explore ${movie.title}${year ? ` (${year})` : \"\"}, including ReelBot's take, cast, runtime, where to watch, and similar movies worth adding to your list.`,
      image: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
        : movie.poster_path
          ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
          : `${ORIGIN}/brand/reelbot-social.png`,
    };
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  const pagePath = String(req.query.path || "/");
  const collectionMatch = pagePath.match(/^\/collections\/([^/?#]+)/);
  const movieMatch = pagePath.match(/^\/movies\/([^/?#]+)/);
  let meta = null;

  if (collectionMatch) meta = collectionMeta(decodeURIComponent(collectionMatch[1]));
  else if (movieMatch) meta = await movieMeta(decodeURIComponent(movieMatch[1]));\n  else if (personMatch) meta = await personMeta(decodeURIComponent(personMatch[1]));

  if (!meta) {
    meta = {
      title: "ReelBot | Find Something Worth Watching",
      description: "Get one tailored movie pick, useful backups, and a faster way to decide what to watch.",
      image: `${ORIGIN}/brand/reelbot-social.png`,
    };
  }

  const url = `${ORIGIN}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  const title = collectionMatch
    ? `${meta.title} | ReelBot Collections`
    : meta.title.includes("ReelBot") ? meta.title : `${meta.title} | ReelBot`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, must-revalidate");
  return res.status(200).send(`<!doctype html><html><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(meta.description)}">
<meta property="og:site_name" content="ReelBot">
<meta property="og:type" content="${escapeHtml(meta.type || "website")}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${escapeHtml(meta.image)}">
<meta property="og:image:secure_url" content="${escapeHtml(meta.image)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="627">
<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt || `${meta.title} on ReelBot`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(meta.description)}">
<meta name="twitter:image" content="${escapeHtml(meta.image)}">
<link rel="canonical" href="${escapeHtml(url)}">
</head><body></body></html>`);
};
