#!/usr/bin/env node
/**
 * scripts/crawlPatek.js
 *
 * Crawl Patek's Watch Finder, collect product URLs, and run scrapePatekProduct.js
 * over them with a configurable concurrency.
 *
 * Usage (Windows CMD examples):
 *   node scripts\crawlPatek.js
 *   node scripts\crawlPatek.js --collections=nautilus,calatrava
 *   node scripts\crawlPatek.js --concurrency=3 --delay=1500 --upload --debug
 *   node scripts\crawlPatek.js --limit=25
 *   node scripts\crawlPatek.js --urls-only         # only write data/patek_urls.json, don't scrape
 *
 * Flags:
 *   --collections   Comma list of families to include (match path segment after /collection/)
 *   --limit         Max number of products to process (after filters)
 *   --concurrency   Parallel product scrapes (default 2)
 *   --delay         ms delay between task starts (default 1000)
 *   --upload        Forward to product scraper (uploads hero image to Cloudinary)
 *   --debug         Forward to product scraper (saves debug HTML/screenshot per ref)
 *   --urls-only     Only collect & save URLs (no per-product scraping)
 *   --save          Custom path for URL list (default data/patek_urls.json)
 *
 * Requires:
 *   - Playwright installed (chromium)
 *   - scripts/scrapePatekProduct.js present (the one you just built)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const START_URL = 'https://www.patek.com/en/collection/watch-finder';
const SCRAPER = path.join(__dirname, 'scrapePatekProduct.js');

// ---------- CLI ----------
const argv = process.argv.slice(2);
function flag(name, def) {
  const v = argv.find(a => a.startsWith(name + '=')) || argv.find(a => a === name);
  if (!v) return def;
  if (v.includes('=')) {
    return v.split('=').slice(1).join('=').trim();
  }
  // bare flag => true
  return true;
}
const collectionsArg = String(flag('--collections', '') || '').trim(); // e.g., "nautilus,calatrava"
const LIMIT = parseInt(flag('--limit', ''), 10) || 0;
const CONCURRENCY = Math.max(1, parseInt(flag('--concurrency', ''), 10) || 2);
const DELAY_MS = Math.max(0, parseInt(flag('--delay', ''), 10) || 1000);
const FORWARD_UPLOAD = !!flag('--upload', false);
const FORWARD_DEBUG = !!flag('--debug', false);
const URLS_ONLY = !!flag('--urls-only', false);
const SAVE_PATH = flag('--save', path.join(PROJECT_ROOT, 'data', 'patek_urls.json'));

// ---------- helpers ----------
function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function uniq(arr) { return Array.from(new Set(arr)); }
function toAbs(u) { try { return new URL(u, START_URL).href; } catch { return ''; } }

// ---------- crawl ----------
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
    try { const btn = await page.$(sel); if (btn) { await btn.click({ timeout: 1500 }); await page.waitForTimeout(300); break; } } catch {}
  }
  try { await ctx.storageState({ path: statePath }); } catch {}
}

async function scrollAndCollect(page) {
  let prevCount = 0;
  let sameCountTicks = 0;

  for (let i = 0; i < 40; i++) { // cap to avoid infinite loops
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle').catch(()=>{});
    await page.waitForTimeout(600);

    // try clicking any "load more" / "show more" buttons if present
    const loadMoreSelectors = [
      'button:has-text("Load more")',
      'button:has-text("Show more")',
      'a:has-text("Load more")',
      'a:has-text("Show more")'
    ];
    for (const sel of loadMoreSelectors) {
      try { const b = await page.$(sel); if (b) { await b.click({ timeout: 1000 }).catch(()=>{}); await page.waitForTimeout(800); } } catch {}
    }

    const count = await page.$$eval('a', as => as.length);
    if (count === prevCount) sameCountTicks++; else sameCountTicks = 0;
    prevCount = count;

    if (sameCountTicks >= 3) break; // stable for a few iterations
  }

  // collect product links
  const hrefs = await page.$$eval('a', as => as.map(a => a.getAttribute('href') || '').filter(Boolean));
  const abs = uniq(hrefs.map(toAbs)).filter(h =>
    /^https?:\/\/www\.patek\.com\/en\/collection\/[a-z-]+\/[0-9a-z\-]+$/i.test(h)
  );

  return abs;
}

function filterCollections(urls, collectionsCsv) {
  if (!collectionsCsv) return urls;
  const set = new Set(collectionsCsv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return urls.filter(u => {
    try {
      const p = new URL(u).pathname.split('/').filter(Boolean); // ['en','collection','nautilus','5712-1r-001']
      const i = p.indexOf('collection');
      const fam = (i !== -1 && p[i+1]) ? p[i+1].toLowerCase() : '';
      return set.has(fam);
    } catch { return false; }
  });
}

// ---------- run scraper on a single URL ----------
function runProductScraper(url, { upload=false, debug=false } = {}) {
  return new Promise((resolve) => {
    const args = [SCRAPER, url, '--write'];
    if (upload) args.push('--upload');
    if (debug) args.push('--debug');
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '', err = '';
    child.stdout.on('data', d => { out += d.toString(); });
    child.stderr.on('data', d => { err += d.toString(); });

    child.on('close', code => {
      resolve({ code, out, err });
    });
  });
}

// ---------- simple task pool ----------
async function runPool(urls, workerCount, delayMs, opts) {
  let idx = 0, ok = 0, fail = 0;
  async function worker(id) {
    while (true) {
      const i = idx++;
      if (i >= urls.length) break;
      const url = urls[i];
      console.log(`[${i+1}/${urls.length}] [W${id}] ${url}`);
      const res = await runProductScraper(url, opts);
      if (res.code === 0) {
        ok++;
        // keep output light; uncomment to see details:
        // console.log(res.out.trim());
      } else {
        fail++;
        console.warn(`! Failed [${url}] code=${res.code}\n${res.err}`);
      }
      if (delayMs) await sleep(delayMs);
    }
  }

  const workers = Array.from({ length: workerCount }, (_, i) => worker(i+1));
  await Promise.all(workers);
  return { ok, fail };
}

// ---------- main ----------
(async () => {
  console.log('[crawl] start:', START_URL);

  // 1) open & collect all product URLs
  const statePath = path.join(PROJECT_ROOT, 'tmp', 'patek_debug', 'storage-state.json');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: fs.existsSync(statePath) ? statePath : undefined });
  const page = await ctx.newPage();

  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await acceptCookies(page, ctx, statePath);
  const urlsAll = await scrollAndCollect(page);
  await browser.close();

  if (!urlsAll.length) {
    console.error('No product URLs found. The page structure may have changed.');
    process.exit(2);
  }

  let urls = urlsAll.slice();
  urls = filterCollections(urls, collectionsArg);
  if (LIMIT > 0) urls = urls.slice(0, LIMIT);

  // 2) save URL list for visibility / reuse
  ensureDir(path.dirname(SAVE_PATH));
  fs.writeFileSync(SAVE_PATH, JSON.stringify(urls, null, 2), 'utf8');
  console.log('[crawl] collected:', urlsAll.length, 'urls');
  if (urls.length !== urlsAll.length) {
    console.log('[crawl] after filters:', urls.length, 'urls');
  }
  console.log('[crawl] saved URL list →', SAVE_PATH);

  if (URLS_ONLY) {
    console.log('[crawl] --urls-only set; not scraping individual pages.');
    process.exit(0);
  }

  // 3) run product scraper over urls with a small pool
  console.log(`[crawl] scraping ${urls.length} page(s) with concurrency=${CONCURRENCY}, delay=${DELAY_MS}ms, upload=${FORWARD_UPLOAD}, debug=${FORWARD_DEBUG}`);
  const { ok, fail } = await runPool(urls, CONCURRENCY, DELAY_MS, { upload: FORWARD_UPLOAD, debug: FORWARD_DEBUG });
  console.log(`[crawl] done. ok=${ok} fail=${fail}`);

  // 4) reminder: data/references.json is being upserted by the product scraper (--write)
  console.log('➡ Now load into Mongo when ready:');
  console.log('   node scripts\\loadReferencesToMongo.js --file data\\references.json');
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
