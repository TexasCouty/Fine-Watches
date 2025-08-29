// scripts/retunePatekImages.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { v2: cloudinary } = require('cloudinary');

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'data', 'references.json');

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('Missing Cloudinary env vars. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

function loadJson(fp) { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
function saveJson(fp, obj) { fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8'); }
function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function absolutize(urlLike, base){ try { return new URL(urlLike, base).href; } catch { return ''; } }
function publicIdFor(item){ const coll = item.Collection ? slugify(item.Collection) : 'misc'; return `patek/${coll}/${item.Reference}`; }

function isLikelyNonProduct(u){
  u = u.toLowerCase();
  return (
    u.includes('logo') || u.includes('favicon') || u.includes('sprite') ||
    u.includes('icon') || u.includes('placeholder') || u.endsWith('.svg') || u.includes('image/svg')
  );
}
function pickLargestFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const entries = srcset.split(',').map(s => s.trim()).map(s => {
    const m = s.match(/(.+?)\s+(\d+)w/);
    if (m) return { url: absolutize(m[1].trim(), baseUrl), w: parseInt(m[2], 10) };
    return { url: absolutize(s.split(' ')[0], baseUrl), w: 0 };
  }).filter(x => !!x.url);
  entries.sort((a,b)=>b.w-a.w);
  return entries[0]?.url || '';
}
function widthHint(url) {
  const u = url.toLowerCase();
  let score = 0;
  if (u.includes('press-hor')) score += 2000;
  if (u.includes('16-9-banner')) score += 500;
  if (u.includes('det-overview')) score += 200;

  const widMatch = u.match(/[?&](?:w|wid|width)=([\d]+)/);
  if (widMatch) score += parseInt(widMatch[1], 10);
  const sizeMatch = u.match(/[?&]size=([\d]{3,4})(?:[,x]([\d]{3,4}))?/);
  if (sizeMatch) score += parseInt(sizeMatch[1], 10);
  const whMatch = u.match(/(\d{3,4})x(\d{3,4})/);
  if (whMatch) score += parseInt(whMatch[1], 10);
  if (/\.(jpe?g)(\?|$)/.test(u)) score += 200;
  if (/\.(webp|avif)(\?|$)/.test(u)) score += 150;
  score += Math.min(u.length / 10, 200);
  return score;
}
function gatherCandidateImages($, baseUrl) {
  const set = new Set();
  const push = (url) => {
    if (!url) return;
    const abs = absolutize(url, baseUrl);
    if (!abs) return;
    if (isLikelyNonProduct(abs)) return;
    set.add(abs);
  };
  $('meta[property="og:image"], meta[name="og:image"], meta[property="og:image:secure_url"]').each((_, el) => { push($(el).attr('content')); });
  $('meta[property="twitter:image"], meta[name="twitter:image"]').each((_, el) => { push($(el).attr('content')); });
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text().trim());
      const objs = Array.isArray(json) ? json : [json];
      for (const o of objs) {
        const img = o && o.image;
        if (!img) continue;
        if (typeof img === 'string') push(img);
        else if (Array.isArray(img)) img.forEach(push);
      }
    } catch {}
  });
  $('link[rel="preload"][as="image"]').each((_, el) => { push($(el).attr('href')); });
  $('img').each((_, el) => {
    const ss = $(el).attr('srcset');
    if (ss) push(pickLargestFromSrcset(ss, baseUrl));
    push($(el).attr('src'));
  });
  return Array.from(set);
}
function pickBestImageUrl(candidates) {
  const scored = candidates.map((url)=>({url,score:widthHint(url)})).sort((a,b)=>b.score-a.score);
  return scored[0]?.url || '';
}
async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': new URL(url).origin
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return await res.text();
}
async function downloadBuffer(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': new URL(url).origin
    }
  });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}
async function uploadToCloudinary(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, resource_type: 'image', format: 'jpg' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

(async () => {
  const refs = loadJson(DATA_PATH);
  const toProcess = refs
    .map((r, i) => ({ r, i }))
    .filter(x => (x.r.Brand || '').trim().toLowerCase() === 'patek philippe' && x.r.SourceURL);

  console.log(`Will (re)pick images for ${toProcess.length} Patek references…`);

  let changed = 0;
  for (const { r: item, i: idx } of toProcess) {
    try {
      console.log(`\n→ ${item.Reference}  (${item.SourceURL})`);
      const html = await fetchHtml(item.SourceURL);
      const $ = cheerio.load(html);
      const candidates = gatherCandidateImages($, item.SourceURL);
      const best = pickBestImageUrl(candidates);
      if (!best) { console.warn('  no suitable image candidates'); continue; }

      console.log('  chosen:', best);
      const buf = await downloadBuffer(best);
      const pubId = publicIdFor(item);
      console.log('  uploading:', pubId);
      const uploaded = await uploadToCloudinary(buf, pubId);
      const secure = uploaded.secure_url;
      console.log('  cloudinary:', secure);

      refs[idx] = { ...item, ImageFilename: secure };
      changed++;
      // Save after each to be safe
      saveJson(DATA_PATH, refs);
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
    }
  }

  console.log(`\nDone. Updated ${changed} images.`);
  console.log('\nNext step to reflect on site:');
  console.log('  node scripts\\loadReferencesToMongo.js');
})();
