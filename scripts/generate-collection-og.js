const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const API = "https://movie-review-backend-zevb.onrender.com";
const OUT = path.join(process.cwd(), "public", "social", "collections");
const source = fs.readFileSync(path.join(process.cwd(), "src", "collections.js"), "utf8");

function collectionsFromSource() {
  const blocks = source.split(/\n  \{\n/).slice(1);
  return blocks.map((block) => {
    const pick = (key) => block.match(new RegExp(key + '\\s*:\\s*"([^"]*)"'))?.[1] || "";
    const moviesMatch = block.match(/movies\s*:\s*\[([\s\S]*?)\]/);
    const movies = moviesMatch ? [...moviesMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    return { slug: pick("slug"), title: pick("title"), eyebrow: pick("eyebrow"), movies };
  }).filter((item) => item.slug && item.title);
}

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function posterFor(slug) {
  try {
    const movieRes = await fetchWithTimeout(`${API}/movies/resolve/${encodeURIComponent(slug)}`);
    if (!movieRes.ok) return null;
    const movie = await movieRes.json();
    if (!movie.poster_path) return null;
    const imageRes = await fetchWithTimeout(`https://image.tmdb.org/t/p/w500${movie.poster_path}`);
    return imageRes.ok ? Buffer.from(await imageRes.arrayBuffer()) : null;
  } catch { return null; }
}

function escapeXml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;" }[c]));
}

function wrapTitle(title, max = 24) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function render(collection) {
  const posterBuffers = (await Promise.all(collection.movies.slice(0, 3).map(posterFor))).filter(Boolean);
  const composites = [];
  for (let i = 0; i < posterBuffers.length; i++) {
    const poster = await sharp(posterBuffers[i]).resize(400, 600, { fit: "cover" }).modulate({ brightness: 0.72 }).toBuffer();
    composites.push({ input: poster, left: 1200 - ((i + 1) * 300), top: 15 });
  }
  const lines = wrapTitle(collection.title);
  const titleSvg = lines.map((line, i) => `<text x="72" y="${245 + i * 76}" fill="#fff4de" font-family="Arial,Helvetica,sans-serif" font-size="66" font-weight="800">${escapeXml(line)}</text>`).join("");
  const overlay = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#08101a" stop-opacity="1"/><stop offset=".55" stop-color="#08101a" stop-opacity=".92"/><stop offset="1" stop-color="#08101a" stop-opacity=".3"/></linearGradient></defs>
    <rect width="1200" height="630" fill="url(#g)"/>
    <text x="72" y="104" fill="#e8b45b" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" letter-spacing="4">${escapeXml((collection.eyebrow || "REELBOT COLLECTION").toUpperCase())}</text>
    ${titleSvg}
    <text x="72" y="560" fill="#fff4de" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700">REELBOT</text>
    <text x="212" y="560" fill="#b8c1cf" font-family="Arial,Helvetica,sans-serif" font-size="24">COLLECTIONS</text>
  </svg>`);
  composites.push({ input: overlay, left: 0, top: 0 });
  const out = path.join(OUT, `${collection.slug}.png`);
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#08101a" } }).composite(composites).png({ compressionLevel: 9 }).toFile(out);
  console.log(`OG: ${collection.slug} (${posterBuffers.length} posters)`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const collections = collectionsFromSource();
  for (const collection of collections) await render(collection);
  console.log(`Generated ${collections.length} collection OG images.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
