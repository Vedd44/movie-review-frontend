const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const API = 'https://movie-review-backend-zevb.onrender.com';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function titleLines(title) {
  const lines = []; let line = '';
  for (const word of String(title).slice(0,220).split(/\s+/)) {
    if ((line + ' ' + word).length > 24 && line) { lines.push(line); line = word; } else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines.slice(0,5).map((line,i) => i === 4 && lines.length > 5 ? line.slice(0,21) + '…' : line);
}
module.exports = async (req,res) => {
  const id = String(req.query.movie || '');
  if (!/^\d{1,10}$/.test(id) || Number(id) <= 0) return res.status(400).send('Invalid movie');
  try {
    const response = await fetch(`${API}/movies/${id}`, {signal:AbortSignal.timeout(10000)});
    if (!response.ok) return res.status(response.status === 404 ? 404 : 503).send('Movie unavailable');
    const movie = await response.json();
    const layers = [];
    if (/^\/[a-zA-Z0-9._-]+$/.test(movie.poster_path || '')) {
      try {
        const poster = await fetch(`https://image.tmdb.org/t/p/w500${movie.poster_path}`, {signal:AbortSignal.timeout(8000)});
        if (poster.ok) layers.push({input:await sharp(Buffer.from(await poster.arrayBuffer())).resize(330,495,{fit:'cover'}).toBuffer(),left:64,top:68});
      } catch { /* The branded title card remains useful without artwork. */ }
    }
    const mark = fs.readFileSync(path.join(process.cwd(),'public/brand/reelbot-icon.svg'));
    layers.push({input:await sharp(mark).resize(42,48).png().toBuffer(),left:452,top:70});
    const lines = titleLines(movie.title);
    const fontfile = path.join(process.cwd(),'server/assets/reelbot-share.ttf');
    async function addText(text, size, color, left, top, bold = false) {
      const markup = `<span foreground="${color}"${bold ? ' weight="bold"' : ''}>${escape(text)}</span>`;
      const input = await sharp({text:{text:markup,font:`DejaVu Sans ${size}`,fontfile,rgba:true,dpi:72}}).png().toBuffer();
      layers.push({input,left,top});
    }
    await addText('ReelBot',32,'#f4c55e',510,78,true);
    await addText('REELBOT’S PICK',22,'#b7b8bc',452,173);
    for (let i=0;i<lines.length;i++) await addText(lines[i],49,'#f7f3ea',450,222+i*57,true);
    await addText('A movie worth making time for.',23,'#b7b8bc',452,552);
    const image = await sharp({create:{width:1200,height:630,channels:4,background:'#0b0e12'}}).composite(layers).jpeg({quality:90}).toBuffer();
    res.setHeader('Content-Type','image/jpeg'); res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400');
    return res.status(200).send(image);
  } catch { return res.status(503).send('Preview unavailable'); }
};
module.exports.titleLines = titleLines;
