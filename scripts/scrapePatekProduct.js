#!/usr/bin/env node
/**
 * scripts/scrapePatekProduct.js
 *
 * Scrape ONE Patek product page and upsert into data/references.json.
 * Outputs the SAME schema your AP flow used, so your DB/UI stay the same.
 *
 * Usage (Windows CMD examples):
 *   node scripts\scrapePatekProduct.js "https://www.patek.com/en/collection/nautilus/5712-1r-001"
 *   node scripts\scrapePatekProduct.js "https://www.patek.com/en/collection/nautilus/5712-1r-001" --write
 *   node scripts\scrapePatekProduct.js "https://www.patek.com/en/collection/nautilus/5712-1r-001" --write --upload --debug
 *
 * Env (if --upload):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   CLOUDINARY_FOLDER (optional, defaults to "patek")
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;

// ---------- ENV ----------
const PROJECT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'patek';

// ---------- CLI ----------
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/scrapePatekProduct.js <PatekProductURL> [--write] [--upload] [--debug] [--clear-state]');
  process.exit(1);
}
const PRODUCT_URL   = args[0];
const FLAG_WRITE    = args.includes('--write');
const FLAG_UPLOAD   = args.includes('--upload');
const FLAG_DEBUG    = args.includes('--debug');
const FLAG_CLEAR    = args.includes('--clear-state');

// ---------- Paths ----------
const OUT_JSON = path.join(PROJECT_ROOT, 'data', 'references.json');
const DEBUG_DIR_ROOT = path.join(PROJECT_ROOT, 'tmp', 'patek_debug');

// ---------- Helpers ----------
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function nowISO() { const d = new Date(); d.setMilliseconds(0); return d.toISOString().slice(0,10); }
function parseCurrency(s) {
  if (!s) return { amount: null, currency: '' };
  const cur = s.includes('$') ? 'USD' : s.includes('€') ? 'EUR' : s.includes('£') ? 'GBP' : '';
  const num = Number(String(s).replace(/[^0-9.\-]/g, ''));
  return { amount: isNaN(num) ? null : num, currency: cur };
}
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}
function upsertJsonByReference(filePath, doc) {
  let arr = [];
  if (fs.existsSync(filePath)) {
    try { arr = JSON.parse(fs.readFileSync(filePath, 'utf8')) || []; } catch {}
    if (!Array.isArray(arr)) arr = [];
  }
  let replaced = false;
  arr = arr.map(row => {
    if (row.Reference === doc.Reference) { replaced = true; return { ...row, ...doc }; }
    return row;
  });
  if (!replaced) arr.push(doc);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
}

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key:    process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

async function uploadImage(localPath, publicId) {
  if (!FLAG_UPLOAD) return null;
  if (!cloudinary.config().cloud_name) {
    console.warn('! --upload set but CLOUDINARY_* env vars are missing; skipping upload');
    return null;
  }
  const res = await cloudinary.uploader.upload(localPath, {
    folder: CLOUDINARY_FOLDER,
    public_id: publicId,
    use_filename: true,
    unique_filename: false,
    overwrite: true,
    invalidate: true,
  });
  return res.secure_url || res.url || null;
}

// ---------- Page helpers ----------
async function acceptCookies(page, ctx, statePath) {
  const cookieSelectors = [
    'button#onetrust-accept-btn-handler',
    'button[aria-label="Accept all"]',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("I Accept")',
    'button:has-text("Allow all")',
  ];
  for (const sel of cookieSelectors) {
    try { const btn = await page.$(sel); if (btn) { await btn.click({ timeout: 2000 }); await page.waitForTimeout(500); break; } } catch {}
  }
  try { await ctx.storageState({ path: statePath }); } catch {}
}

// ---------- Robust DIAL/CASE/BRACELET (deduped & concise) ----------
async function extractTechSections(page) {
  return await page.evaluate(() => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const splitSentences = s => norm(s)
      .split(/(?<=[.!?])\s+|;|\u2022|·/g)
      .map(x => norm(x.replace(/^[-–•·]\s*/, '')))
      .filter(Boolean);

    const titles = ['dial','case','bracelet'];
    const sections = { Dial: '', Case: '', Bracelet: '' };
    const seen = { Dial: new Set(), Case: new Set(), Bracelet: new Set() };

    // find all nodes that look like a section heading
    const all = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,span,div,p,li'));
    for (let i = 0; i < all.length; i++) {
      const labelText = norm(all[i].innerText || all[i].textContent || '').toLowerCase();
      if (!labelText) continue;
      const hit = titles.find(t => labelText === t || labelText.startsWith(t + ':'));
      if (!hit) continue;

      const key = hit.charAt(0).toUpperCase() + hit.slice(1); // Dial/Case/Bracelet
      const buf = [];

      // collect forward until hitting another tech title or a known heading
      for (let j = i + 1; j < all.length; j++) {
        const el = all[j];
        const t = norm(el.innerText || el.textContent || '');
        const tl = t.toLowerCase();
        if (!t) continue;

        if (['dial','case','bracelet','movement','technical characteristics'].includes(tl)) break;
        if (/^(movement|technical characteristics)\b/i.test(tl)) break;

        // stop at typical bold specs labels
        if (/^(diameter|thickness|number of parts|number of jewels|power reserve|winding rotor|frequency|balance spring|distinctive sign)\b/i.test(tl)) break;

        // accumulate sentences, dedup
        splitSentences(t).forEach(s => {
          if (!seen[key].has(s)) {
            seen[key].add(s);
            buf.push(s);
          }
        });

        // keep it readable
        if (buf.join(' ').length > 300) break;
      }

      if (buf.length && !sections[key]) {
        // keep first 2–3 sentences max to avoid verbosity
        const compact = buf.slice(0, 3).join(' ');
        sections[key] = compact;
      }
    }

    return sections;
  });
}

// ---------- MOVEMENT (functions + bolded pairs, deduped) ----------
async function extractMovement(page) {
  return await page.evaluate(() => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();

    // locate movement block
    let mvRoot = null;
    const elems = Array.from(document.querySelectorAll('h2,h3,h4,div,section,article'));
    for (const e of elems) {
      const t = norm(e.innerText || e.textContent).toLowerCase();
      if (t.startsWith('movement')) { mvRoot = e.closest('section,article,div') || e; break; }
    }
    if (!mvRoot) return {};

    const cal = {};

    // ---------- Functions (before bold labels) ----------
    const children = Array.from(mvRoot.childNodes);
    const rawLines = [];
    let sawLabel = false;
    for (const c of children) {
      const isElem = c.nodeType === 1;
      const txt = norm(isElem ? (c.innerText || c.textContent) : c.textContent);
      if (!txt) continue;

      // bold labels start — stop adding raw lines
      if (/^(diameter|thickness|number of parts|number of jewels|power reserve|winding rotor|frequency|balance spring|distinctive sign)\b/i.test(txt)) {
        sawLabel = true;
      }
      if (sawLabel) continue;

      // skip the heading & mechanism-only line (we capture mechanism separately)
      if (/^movement\b/i.test(txt)) continue;
      if (/^(self[-\s]?winding|manual|automatic)\b/i.test(txt)) continue;

      rawLines.push(txt);
    }

    // split on bullets/periods/semicolons, drop label-like fragments and calibre name
    const mvTxt = norm(mvRoot.innerText || mvRoot.textContent || '');
    // Detect calibre-ish name e.g. "240 PS IRM C LU" to avoid keeping it as a "function"
    const calName = (mvTxt.match(/\b[0-9]{3}[A-Z0-9\s\-]+(?:[A-Z]{2,})\b/) || [null])[0];
    const funcParts = rawLines
      .join(' ')
      .split(/(?<=[.!?])\s+|;|\u2022|·/g)
      .map(s => norm(s.replace(/^[-–•·]\s*/, '')))
      .filter(Boolean)
      .filter(s => !/^\s*(diameter|thickness|number of parts|number of jewels|power reserve|winding rotor|frequency|balance spring|distinctive sign)\s*:/i.test(s))
      .filter(s => !calName || s.toLowerCase() !== calName.toLowerCase());

    const uniqueFuncs = Array.from(new Set(funcParts)).filter(s => s.length <= 120);
    if (uniqueFuncs.length) cal.Functions = uniqueFuncs;

    // ---------- Mechanism + Name ----------
    const mech = mvTxt.match(/\b(Self[-\s]?winding|Manual|Automatic)\b/i);
    if (mech) cal.Mechanism = mech[0];
    if (calName) cal.Name = calName.trim();

    // ---------- Bold label pairs ----------
    const html = mvRoot.innerHTML || '';
    function pick(label) {
      const rx = new RegExp('<strong[^>]*>\\s*' + label + '\\s*:<\\/strong>\\s*([^<]+)', 'i');
      const m = html.match(rx);
      return m ? norm(m[1]) : '';
    }
    const diameter  = pick('Diameter');
    const thickness = pick('Thickness');
    const nParts    = pick('Number of parts');
    const nJewels   = pick('Number of jewels');
    const pwrRes    = pick('Power reserve');
    const rotor     = pick('Winding rotor');
    const freq      = pick('Frequency');
    const balance   = pick('Balance spring');
    const sign      = pick('Distinctive sign');

    if (diameter)  cal.TotalDiameter   = diameter;
    if (thickness) cal.Thickness       = thickness;
    if (nParts)    cal.NumberOfParts   = nParts.replace(/[^0-9\-–]+/g,'').replace(/^$/,'');
    if (nJewels)   cal.NumberOfJewels  = nJewels.replace(/[^0-9\-–]+/g,'').replace(/^$/,'');
    if (pwrRes)    cal.PowerReserve    = pwrRes;
    if (freq)      cal.Frequency       = freq;
    if (rotor)     cal.WindingRotor    = rotor;
    if (balance)   cal.BalanceSpring   = balance;
    if (sign)      cal.DistinctiveSign = sign;

    return cal;
  });
}

// Price (accepts $, €, £)
async function pullPrice(page) {
  const body = (await page.textContent('body')) || '';
  const m = body.match(/[$€£]\s*[0-9][0-9,.\s]+/);
  if (!m) return { raw: '', currency: '', amount: null };
  const raw = m[0].replace(/\s+/g,' ').trim();
  const { amount, currency } = parseCurrency(raw);
  return { raw, currency, amount };
}

// ---------- Main scrape ----------
(async () => {
  const statePath = path.join(DEBUG_DIR_ROOT, 'storage-state.json');
  if (FLAG_CLEAR && fs.existsSync(statePath)) fs.unlinkSync(statePath);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: fs.existsSync(statePath) ? statePath : undefined });
  const page = await ctx.newPage();

  console.log('[open]', PRODUCT_URL);
  await page.goto(PRODUCT_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await acceptCookies(page, ctx, statePath);
  await page.waitForLoadState('networkidle', { timeout: 120_000 });

  // URL fallback: /en/collection/<family>/<reference>
  let urlCollection = '', urlReference = '';
  try {
    const u = new URL(PRODUCT_URL);
    const parts = u.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('collection');
    if (i !== -1 && parts[i+1]) urlCollection = parts[i+1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (i !== -1 && parts[i+2]) urlReference = parts[i+2].toUpperCase();
  } catch {}

  const data = {
    Reference: '',
    Brand: 'Patek Philippe',
    Collection: urlCollection || '',
    Description: '',
    Details: '',
    Case: '',
    Dial: '',
    Bracelet: '',
    Price: '',
    PriceCurrency: '',
    PriceAmount: null,
    ImageFilename: '',
    Calibre: {},
    Specs: {},
    SourceURL: PRODUCT_URL,
    Aliases: [],
    LastUpdated: nowISO(),
  };

  // Title/Description + Reference
  try {
    const h1 = await page.$('h1');
    const title = h1 ? (await h1.innerText()).trim() : '';
    const subtitle = ((await page.textContent('h2, .h2')) || '').trim();
    if (title) {
      data.Description = [title, subtitle].filter(Boolean).join(' — ');
      const r = title.match(/\b([0-9]{3,4}(?:\/[0-9A-Z]+)?-[0-9A-Z]{3})\b/);
      if (r) data.Reference = r[1];
    }
  } catch {}

  if (!data.Reference) {
    const bodyTxt = await page.textContent('body');
    const m = bodyTxt && bodyTxt.match(/\b([0-9]{3,4}(?:\/[0-9A-Z]+)?-[0-9A-Z]{3})\b/);
    if (m) data.Reference = m[1];
  }
  if (!data.Reference && urlReference) data.Reference = urlReference;

  if (FLAG_DEBUG) {
    ensureDir(DEBUG_DIR_ROOT);
    fs.writeFileSync(path.join(DEBUG_DIR_ROOT, 'page.html'), await page.content(), 'utf8');
  }

  // Technical characteristics (Dial/Case/Bracelet)
  const tech = await extractTechSections(page);
  data.Dial     = tech.Dial     || data.Dial;
  data.Case     = tech.Case     || data.Case;
  data.Bracelet = tech.Bracelet || data.Bracelet;

  // Movement / Calibre
  data.Calibre = await extractMovement(page);

  // Details (meta or first paragraph)
  try {
    const metaDesc = await page.$('meta[name="description"]');
    if (metaDesc) {
      const c = await metaDesc.getAttribute('content');
      if (c && !data.Details) data.Details = c.trim();
    }
  } catch {}
  if (!data.Details) {
    try {
      const p = await page.$('main p, article p, .content p');
      if (p) data.Details = (await p.innerText()).trim();
    } catch {}
  }

  // Price
  const p = await pullPrice(page);
  if (p.raw) { data.Price = p.raw; data.PriceCurrency = p.currency; data.PriceAmount = p.amount; }

  // Image: og:image first, else biggest <img>
  let heroUrl = '';
  try {
    const og = await page.$('meta[property="og:image"], meta[name="og:image"]');
    if (og) {
      const c = await og.getAttribute('content');
      if (c && /^https?:/i.test(c)) heroUrl = c;
    }
  } catch {}
  if (!heroUrl) {
    const imgs = await page.$$('img');
    let best = { url: '', area: 0 };
    for (const img of imgs) {
      try {
        const src = await img.getAttribute('src');
        if (!src || !/^https?:/i.test(src)) continue;
        const box = await img.boundingBox();
        const area = box ? box.width * box.height : 0;
        if (area > best.area) best = { url: src, area };
      } catch {}
    }
    heroUrl = best.url;
  }

  if (heroUrl && FLAG_UPLOAD) {
    const tmpDir = path.join(DEBUG_DIR_ROOT, slugify(data.Reference || 'unknown'));
    ensureDir(tmpDir);
    const imgPath = path.join(tmpDir, 'hero.jpg');
    try {
      const resp = await page.request.get(heroUrl);
      const buf = Buffer.from(await resp.body());
      fs.writeFileSync(imgPath, buf);
      const publicId = (data.Reference ? data.Reference : slugify(heroUrl)).replace(/[^\w\-/.]/g,'-');
      const uploaded = await uploadImage(imgPath, publicId);
      if (uploaded) data.ImageFilename = uploaded;
      else data.ImageFilename = heroUrl;
    } catch { data.ImageFilename = heroUrl; }
  } else if (heroUrl) {
    data.ImageFilename = heroUrl;
  }

  await browser.close();

  if (!data.Reference) {
    console.error('! Could not determine Reference from page. Aborting (no write).');
    process.exit(2);
  }

  if (FLAG_WRITE) {
    upsertJsonByReference(OUT_JSON, data);
    console.log(`✔ Updated ${OUT_JSON} (Reference: ${data.Reference})`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
