// scripts/crawlAP.js
// Crawl Audemars Piguet collections and call scrapeAPProduct.js on each product.
// Usage examples (Windows):
//   node scripts/crawlAP.js --all --write --upload
//   node scripts/crawlAP.js --collections=royal-oak,royal-oak-offshore --max=100 --write --upload --debug
//
// Flags:
//   --all                      crawl all known collections
//   --collections=a,b,c        subset of collections (slugs)
//   --max=N                    limit per collection (default: unlimited)
//   --write                    pass through to scraper (updates references.json)
//   --upload                   pass through to scraper (uploads images to Cloudinary)
//   --debug                    pass through (keeps per-page debug artifacts)
//   --headless                 run headless (default if HEADFUL not set)
//   --concurrency=N           parallel scrapes (default 2)
//   --delay=ms                delay between launches (default 2500ms)
//   --resume                   skip products already found in references.json

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { spawn } = require('child_process');

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'data', 'references.json');

function ensureDir(d){ try{ fs.mkdirSync(d,{recursive:true}); }catch{} }
function loadJson(f){ try{ return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {_=>{}; return []; } }

const KNOWN = [
  'code-1159',
  'royal-oak',
  'royal-oak-offshore',
  'royal-oak-concept',
  // 'millenary', 'jules-audemars' // include if you want these legacy families
];

const ARGS = new Set(process.argv.slice(2));
function flag(name){ return ARGS.has(`--${name}`); }
function val(name, def) {
  const m = [...ARGS].find(a=>a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=').trim() : def;
}

const useAll       = flag('all');
const collections  = useAll
  ? KNOWN
  : (val('collections','')||'').split(',').map(s=>s.trim()).filter(Boolean);
const maxPerFamily = parseInt(val('max','-1'),10);
const doWrite      = flag('write');
const doUpload     = flag('upload');
const doDebug      = flag('debug');
const headless     = flag('headless') || !process.env.HEADFUL;
const concurrency  = Math.max(1, parseInt(val('concurrency','2'),10));
const launchDelay  = Math.max(0, parseInt(val('delay','2500'),10));
const resume       = flag('resume');

if (!useAll && collections.length === 0) {
  console.error('Specify --all or --collections=a,b,c');
  process.exit(1);
}

const START = collections.map(c => `https://www.audemarspiguet.com/com/en/watch-collection/${c}.html`);
const PRODUCT_RE = /\/watch-collection\/[^/]+\/[0-9A-Z]{5}[A-Z0-9]{2}\.[A-Z0-9]{2}\.[A-Z0-9]{4,6}\.\d{2}\.html$/i;

function uniq(arr){ return Array.from(new Set(arr)); }

async function acceptCookies(page){
  const sels = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept all cookies")',
    'button:has-text("Accept All")',
    '[role="button"]:has-text("Accept")',
  ];
  const end = Date.now()+10000;
  while(Date.now()<end){
    for(const s of sels){
      try{
        const btn = page.locator(s).first();
        if(await btn.count()){ await btn.click({timeout:800}).catch(()=>{}); return; }
      }catch{}
    }
    for(const f of page.frames()){
      try{
        const b = f.locator('button:has-text("Accept")').first();
        if(await b.count()) await b.click({timeout:800}).catch(()=>{});
      }catch{}
    }
    await page.waitForTimeout(300);
  }
}

async function discoverProductsInCollection(context, url){
  const page = await context.newPage();
  const found = new Set();
  try{
    await page.goto(url, { waitUntil:'networkidle', timeout:120000 }).catch(async ()=>{
      await page.goto(url, { waitUntil:'domcontentloaded', timeout:120000 });
    });
    await acceptCookies(page);

    // Scroll/load loop: try to reveal lazy tiles or "load more"
    for(let i=0;i<20;i++){
      // Click "Load more" if present
      const btn = page.locator('button:has-text("Load more"), a:has-text("Load more")').first();
      if(await btn.count()) { await btn.click({timeout:1500}).catch(()=>{}); await page.waitForTimeout(800); }

      // Collect anchors
      const links = await page.evaluate((reStr)=>{
        const re = new RegExp(reStr, 'i');
        function abs(h){ try { return new URL(h, location.href).href; } catch { return ''; } }
        const out = new Set();
        document.querySelectorAll('a[href]').forEach(a=>{
          const href = abs(a.getAttribute('href'));
          if (re.test(href)) out.add(href);
        });
        return Array.from(out);
      }, PRODUCT_RE.source);
      links.forEach(h=>found.add(h));

      // Scroll down
      await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight, behavior:'instant'}));
      await page.waitForTimeout(900);
      // Stop if nothing new for a few loops
      if (i>5 && links.length===0) break;
    }
  } catch(e) {
    console.error(`Discovery failed for ${url}: ${e.message}`);
  } finally {
    await page.close().catch(()=>{});
  }
  return Array.from(found);
}

function alreadyHave(reference){
  const list = loadJson(DATA_PATH);
  return list.some(x => (x.Reference||'').toUpperCase() === reference.toUpperCase());
}

function refFromProductUrl(u){
  const m = u.match(/([0-9A-Z]{5}[A-Z0-9]{2}\.[A-Z0-9]{2}\.[A-Z0-9]{4,6}\.\d{2})\.html$/i);
  return m ? m[1] : '';
}

function runScraper(url, { write, upload, debug, headless }){
  return new Promise((resolve) => {
    const args = [path.join('scripts','scrapeAPProduct.js'), url];
    if (write)   args.push('--write');
    if (upload)  args.push('--upload');
    if (debug)   args.push('--debug');
    if (headless)args.push('--headless');

    // Keep cookie banner state across products
    // (we *do not* pass --clear-state here)
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, HEADFUL: headless ? '' : (process.env.HEADFUL||'1') },
      stdio: ['ignore','pipe','pipe'],
    });

    child.stdout.on('data', d => process.stdout.write(d));
    child.stderr.on('data', d => process.stderr.write(d));
    child.on('exit', (code)=> resolve(code===0));
  });
}

async function poolRun(items, worker, { concurrency=2, delay=0 }={}){
  let i = 0, active = 0, ok=0, fail=0;
  return new Promise((done)=>{
    const next = () => {
      if (i>=items.length && active===0) return done({ok,fail});
      while (active<concurrency && i<items.length){
        const item = items[i++]; active++;
        setTimeout(async () => {
          try{
            const res = await worker(item);
            if (res) ok++; else fail++;
          }catch{ fail++; }
          finally { active--; next(); }
        }, delay);
      }
    };
    next();
  });
}

(async function main(){
  console.log('Collections:', useAll ? KNOWN.join(', ') : collections.join(', '));
  console.log('Options:', { write:doWrite, upload:doUpload, debug:doDebug, headless, concurrency, delay:launchDelay, resume });

  // Discover
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
    viewport:{ width:1440, height:900 },
    locale:'en-US',
    timezoneId:'America/Chicago',
    extraHTTPHeaders:{ 'Accept-Language':'en-US,en;q=0.9' },
  });

  const allLinks = new Set();
  for(const url of START){
    console.log('\n>>> Discovering:', url);
    const links = await discoverProductsInCollection(context, url);
    const family = url.split('/').slice(-1)[0].replace('.html','');
    console.log(`  Found ${links.length} product links in ${family}`);
    links.forEach(h=>allLinks.add(h));
  }
  await browser.close();

  let queue = Array.from(allLinks);
  if (maxPerFamily > 0){
    // keep at most N per family
    const byFamily = {};
    for(const u of queue){
      const fam = (u.match(/watch-collection\/([^/]+)\//i)||[])[1] || 'misc';
      byFamily[fam] = byFamily[fam] || [];
      if (byFamily[fam].length < maxPerFamily) byFamily[fam].push(u);
    }
    queue = Object.values(byFamily).flat();
  }

  // Resume: drop ones already in references.json
  if (resume){
    queue = queue.filter(u => !alreadyHave(refFromProductUrl(u)));
  }

  // Stable order
  queue = uniq(queue).sort((a,b)=>a.localeCompare(b));

  console.log(`\nTotal to scrape: ${queue.length}\n`);

  // Worker
  const worker = async (url) => {
    const ref = refFromProductUrl(url);
    console.log(`\n--- Scraping ${ref} ---`);
    const ok = await runScraper(url, { write:doWrite, upload:doUpload, debug:doDebug, headless });
    console.log(`--- ${ref} ${ok?'OK':'FAIL'} ---`);
    return ok;
  };

  const { ok, fail } = await poolRun(queue, worker, { concurrency, delay: launchDelay });
  console.log(`\nDone. Success: ${ok}, Failed: ${fail}`);
})();
