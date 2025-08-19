// scripts/fetchAPImageAndUpload.js
// Usage (from project root):
//   node scripts/fetchAPImageAndUpload.js 26399NB.OO.D009KB.01 [--debug]
//
// What it does (no headless browser):
// - Loads data/references.json and finds the entry by "Reference"
// - Fetches SourceURL HTML with a desktop UA
// - Gathers MANY image candidates (OG/Twitter, JSON-LD, preload, img[src], img[srcset])
// - Filters out logos/favicons/sprites/placeholders
// - Scores by width/size hints and picks the best product image
// - Downloads it, uploads to Cloudinary as ap/<collection-slug>/<reference>.jpg
// - Updates data/references.json → ImageFilename with the secure_url

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');             // v2
const cheerio = require('cheerio');              // HTML parser
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

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}
function saveJson(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2), 'utf8');
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function publicIdFor(item) {
  const coll = item.Collection ? slugify(item.Collection) : 'misc';
  return `ap/${coll}/${item.Reference}`;
}

function absolutize(urlLike, base) {
  try { return new URL(urlLike, base).href; } catch { return ''; }
}

function pickLargestFromSrcset(srcset, baseUrl) {
  if (!srcset) return '';
  const parts = srcset.split(',').map(s => s.trim());
  let bestUrl = '';
  let bestW = 0;
  for (const p of parts) {
    const m = p.match(/\s+(\d+)w$/);
    const url = p.replace(/\s+\d+w$/, '').trim();
    const w = m ? parseInt(m[1], 10) : 0;
    const abs = absolutize(url, baseUrl);
    if (abs && w >= bestW) {
      bestW = w;
      bestUrl = abs;
    }
  }
  return bestUrl;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`Failed to load page HTML: ${res.status} ${res.statusText}`);
  return await res.text();
}

function isLikelyNonProduct(url) {
  const u = url.toLowerCase();
  return (
    u.includes('logo') ||
    u.includes('logotype') ||
    u.includes('favicon') ||
    u.includes('sprite') ||
    u.includes('icon') ||
    u.includes('placeholder') ||
    u.endsWith('.svg') || u.includes('image/svg')
  );
}

// Tries to estimate "bigness" by reading width params etc.
function widthHint(url) {
  const u = url.toLowerCase();
  let score = 0;

  // Common dynamic media params: wid=, size=1920,0 / &wid=1920
  const widMatch = u.match(/[?&](?:w|wid|width)=([\d]+)/);
  if (widMatch) score += parseInt(widMatch[1], 10);

  const sizeMatch = u.match(/[?&]size=([\d]{3,4})(?:[,x]([\d]{3,4}))?/);
  if (sizeMatch) score += parseInt(sizeMatch[1], 10);

  // If URL contains patterns like 1200x1200
  const whMatch = u.match(/(\d{3,4})x(\d{3,4})/);
  if (whMatch) score += parseInt(whMatch[1], 10);

  // Prefer jpg/webp/avif over small PNGs when not logos
  if (/\.(jpe?g)(\?|$)/.test(u)) score += 200;
  if (/\.(webp|avif)(\?|$)/.test(u)) score += 150;

  // URL length as tie-breaker (often bigger variant)
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

  // 1) Open Graph / Twitter card
  $('meta[property="og:image"], meta[name="og:image"], meta[property="og:image:secure_url"]').each((_, el) => {
    push($(el).attr('content'));
  });
  $('meta[property="twitter:image"], meta[name="twitter:image"]').each((_, el) => {
    push($(el).attr('content'));
  });

  // 2) JSON-LD (Product.image)
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
    } catch {
      /* ignore */
    }
  });

  // 3) Preload hints
  $('link[rel="preload"][as="image"]').each((_, el) => {
    push($(el).attr('href'));
  });

  // 4) IMG elements
  $('img').each((_, el) => {
    const ss = $(el).attr('srcset');
    if (ss) push(pickLargestFromSrcset(ss, baseUrl));
    push($(el).attr('src'));
  });

  return Array.from(set);
}

function pickBestImageUrl(candidates, debug = false) {
  const scored = candidates
    .map((url) => ({ url, score: widthHint(url) }))
    // downrank obvious non-product just in case
    .map((x) => (isLikelyNonProduct(x.url) ? { ...x, score: x.score - 1000 } : x))
    .sort((a, b) => b.score - a.score);

  if (debug) {
    console.log('Top image candidates:');
    for (const c of scored.slice(0, 8)) {
      console.log(` • ${c.score.toFixed(0)}  ${c.url}`);
    }
  }
  return scored.length ? scored[0].url : '';
}

async function downloadBuffer(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
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
      {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        format: 'jpg'
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

(async () => {
  const args = process.argv.slice(2);
  const refArg = (args[0] || '').trim();
  const debug = args.includes('--debug');

  if (!refArg) {
    console.error('Usage: node scripts/fetchAPImageAndUpload.js <REFERENCE> [--debug]');
    process.exit(1);
  }

  const list = loadJson(DATA_PATH);
  const idx = list.findIndex(x => (x.Reference || '').trim() === refArg);
  if (idx === -1) {
    console.error(`Reference ${refArg} not found in ${DATA_PATH}`);
    process.exit(1);
  }

  const item = list[idx];
  if (!item.SourceURL) {
    console.error(`Reference ${refArg} missing "SourceURL" in ${DATA_PATH}`);
    process.exit(1);
  }

  console.log(`Fetching HTML: ${item.SourceURL}`);
  const html = await fetchHtml(item.SourceURL);
  const $ = cheerio.load(html);

  const candidates = gatherCandidateImages($, item.SourceURL);
  if (debug) console.log(`Found ${candidates.length} raw candidates.`);
  const imageUrl = pickBestImageUrl(candidates, debug);

  if (!imageUrl) {
    console.error('Could not find a suitable product image URL on the page.');
    if (!debug) console.error('Tip: rerun with --debug to see candidates.');
    process.exit(1);
  }

  console.log('Selected image URL:', imageUrl);
  const buf = await downloadBuffer(imageUrl);
  const publicId = publicIdFor(item);
  console.log('Uploading to Cloudinary as:', publicId);

  const result = await uploadToCloudinary(buf, publicId);
  console.log('Cloudinary upload complete:', result.secure_url);

  // Update JSON
  list[idx].ImageFilename = result.secure_url;
  list[idx].LastUpdated = new Date().toISOString().slice(0, 10);
  saveJson(DATA_PATH, list);
  console.log('Updated data/references.json');
})().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
