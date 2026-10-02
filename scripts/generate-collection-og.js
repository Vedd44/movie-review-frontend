const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const API = "https://movie-review-backend-zevb.onrender.com";
const OUT = path.join(process.cwd(), "public", "social", "collections");
const MANIFEST_OUT = path.join(process.cwd(), "src", "generatedCollectionMovies.json");
const { readCollections: collectionsFromSource } = require("../server/collections");
const existingManifest = fs.existsSync(MANIFEST_OUT) ? JSON.parse(fs.readFileSync(MANIFEST_OUT, "utf8")) : {};
const { compactMovie } = require("../server/compactMovie");

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

const movieCache = new Map();
async function resolveMovie(slug) {
  if (existingManifest[slug]?.id) return existingManifest[slug];
  if (!movieCache.has(slug)) movieCache.set(slug, (async () => {
    try {
      const res = await fetchWithTimeout(`${API}/movies/resolve/${encodeURIComponent(slug)}`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  })());
  return movieCache.get(slug);
}

async function posterFor(slug) {
  try {
    const movie = await resolveMovie(slug);
    if (!movie.poster_path) return null;
    const imageRes = await fetchWithTimeout(`https://image.tmdb.org/t/p/original${movie.poster_path}`);
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
  const posterWidth = 400;
  const posterHeight = 627;

  for (let i = 0; i < posterBuffers.length; i++) {
    const poster = await sharp(posterBuffers[i])
      .resize(posterWidth * 2, posterHeight * 2, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
      .sharpen({ sigma: 0.65 })
      .toBuffer();
    composites.push({ input: poster, left: i * posterWidth * 2, top: 0 });
  }

  const lines = wrapTitle(collection.title, 32);
  const titleStartY = 470 - ((lines.length - 1) * 70);
  const titleSvg = lines.map((line, i) =>
    `<text x="116" y="${(titleStartY + i * 70) * 2}" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="124" font-weight="800">${escapeXml(line)}</text>`
  ).join("");

  const overlay = Buffer.from(`<svg width="2400" height="1254" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#05080d" stop-opacity=".10"/>
        <stop offset=".42" stop-color="#05080d" stop-opacity=".30"/>
        <stop offset="1" stop-color="#05080d" stop-opacity=".94"/>
      </linearGradient>
    </defs>
    <rect width="2400" height="1254" fill="url(#shade)"/>
    <text x="116" y="${(titleStartY - 66) * 2}" fill="#f4d98d" font-family="Arial,Helvetica,sans-serif" font-size="44" font-weight="700" letter-spacing="6">${escapeXml((collection.eyebrow || "REELBOT COLLECTION").toUpperCase())}</text>
    ${titleSvg}
    <text x="116" y="1150" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="50" font-weight="800">REELBOT</text>
    <text x="352" y="1150" fill="#f4d98d" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="700">COLLECTIONS</text>
  </svg>`);
  composites.push({ input: overlay, left: 0, top: 0 });

  const out = path.join(OUT, `${collection.slug}-v4.jpg`);
  await sharp({ create: { width: 2400, height: 1254, channels: 4, background: "#08101a" } })
    .composite(composites)
    .resize(1200, 627, { kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 96, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(out);
  console.log(`OG: ${collection.slug} (${posterBuffers.length} posters)`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const collections = collectionsFromSource();
  const uniqueSlugs = [...new Set(collections.flatMap((collection) => collection.movies))];
  const resolved = [];
  for (let offset = 0; offset < uniqueSlugs.length; offset += 6) {
    const batch = uniqueSlugs.slice(offset, offset + 6);
    resolved.push(...await Promise.all(batch.map(async (slug) => [slug, await resolveMovie(slug)])));
    console.log(`Resolved ${Math.min(offset + 6, uniqueSlugs.length)}/${uniqueSlugs.length} collection movies.`);
  }
  const manifest = Object.fromEntries(resolved.filter(([, movie]) => movie?.id).map(([slug, movie]) => [slug, compactMovie(movie)]));
  if (Object.keys(manifest).length < uniqueSlugs.length * 0.95) throw new Error("Collection data incomplete; preserving the previous manifest and stopping the build.");
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest));
  fs.writeFileSync(path.join(process.cwd(), "src", "generatedCollectionPreviews.json"), JSON.stringify(Object.fromEntries(Object.entries(manifest).map(([slug, movie]) => [slug, {id: movie.id, poster_path: movie.poster_path}]))));
  console.log(`Collection manifest: ${Object.keys(manifest).length}/${uniqueSlugs.length} movies resolved.`);
  for (const collection of collections) await render(collection);
  console.log(`Generated ${collections.length} collection OG images.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
