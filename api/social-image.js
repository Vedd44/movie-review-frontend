const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const API = "https://movie-review-backend-zevb.onrender.com";
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
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

function getCollection(slug) {
  const block = readCollectionBlock(slug);
  if (!block) return null;
  const title = pickString(block, "title");
  const eyebrow = pickString(block, "eyebrow");
  const moviesMatch = block.match(/movies\s*:\s*\[([\s\S]*?)\]/);
  const movies = moviesMatch
    ? [...moviesMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
    : [];
  if (!title) return null;
  return { title, eyebrow, movies };
}

async function resolvePoster(slug) {
  try {
    const response = await fetch(`${API}/movies/resolve/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    const movie = await response.json();
    if (!movie.poster_path) return null;
    const imageResponse = await fetch(`https://image.tmdb.org/t/p/w780${movie.poster_path}`);
    return imageResponse.ok ? Buffer.from(await imageResponse.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "");
  const collection = getCollection(slug);
  if (!collection) return res.status(404).send("Not found");

  const posters = (await Promise.all(collection.movies.slice(0, 3).map(resolvePoster))).filter(Boolean);
  const width = 1200;
  const height = 630;
  const base = sharp({ create: { width, height, channels: 4, background: "#08101a" } });
  const composites = [];

  for (let index = 0; index < posters.length; index += 1) {
    const poster = await sharp(posters[index])
      .resize(430, 645, { fit: "cover" })
      .modulate({ brightness: 0.58 })
      .toBuffer();
    composites.push({ input: poster, left: index * 385, top: 0 });
  }

  const overlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#08101a" stop-opacity=".96"/><stop offset=".58" stop-color="#08101a" stop-opacity=".56"/><stop offset="1" stop-color="#08101a" stop-opacity=".2"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="72" y="104" fill="#e8b45b" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700" letter-spacing="4">${esc((collection.eyebrow || "REELBOT COLLECTION").toUpperCase())}</text>
    <foreignObject x="70" y="150" width="820" height="310"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;font-size:68px;line-height:1.04;font-weight:800;color:#fff4de;">${esc(collection.title)}</div></foreignObject>
    <text x="72" y="560" fill="#fff4de" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">REELBOT</text>
    <text x="212" y="560" fill="#b8c1cf" font-family="Arial,Helvetica,sans-serif" font-size="24">Find something worth watching.</text>
  </svg>`);
  composites.push({ input: overlay, left: 0, top: 0 });

  const png = await base.composite(composites).png().toBuffer();
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, must-revalidate");
  return res.status(200).send(png);
};
