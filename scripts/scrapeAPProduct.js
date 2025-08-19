// scripts/scrapeAPProduct.js
// Scrape ONE Audemars Piguet product page and upsert into data/references.json
//
// Usage (from project root):
//   node scripts/scrapeAPProduct.js "<FULL_PRODUCT_URL>"
//        [--upload] [--write] [--headless] [--debug] [--trace] [--clear-state]
//
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const fetch = require('node-fetch');
const { v2: cloudinary } = require('cloudinary');

const DATA_DIR  = path.join(process.cwd(), 'data');
const DATA_PATH = path.join(DATA_DIR, 'references.json');
const STATE_DIR  = path.join(process.cwd(), '.playwright');
const STATE_PATH = path.join(STATE_DIR, 'ap-state.json');

function ensureDir(d){ try{ fs.mkdirSync(d,{recursive:true}); }catch{} }
function loadJson(f){ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch{ return []; } }
function saveJson(f,o){ ensureDir(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(o,null,2),'utf8'); }
function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

// allow 4–6 chars in the third block (e.g., D002CR)
const REF_RE = /\b([0-9]{5}[A-Z0-9]{2}\.[A-Z0-9]{2}\.[A-Z0-9]{4,6}\.\d{2})\b/i;

const COLLECTION_MAP = {
  'royal-oak': 'Royal Oak',
  'royal-oak-offshore': 'Royal Oak Offshore',
  'royal-oak-concept': 'Royal Oak Concept',
  'code-1159': 'Code 11.59',
  'millenary': 'Millenary',
  'jules-audemars': 'Jules Audemars',
};
const mapCollection = (seg) =>
  COLLECTION_MAP[seg] || (seg ? seg.split('-').map(w=>w[0]?.toUpperCase()+w.slice(1)).join(' ') : '');

// ---------- image helpers ----------
const EXCLUDE_URL_RE = /(thumbnail[_/]|\/is\/content\/|logotype|logo|sprite|icon|fragment|favicon)/i;
const isBad = (u) => EXCLUDE_URL_RE.test(String(u||'').toLowerCase());
function isLikelyWatch(u){
  const s = String(u||'').toLowerCase();
  if (isBad(s)) return false;
  return s.includes('/is/image/') || s.includes('audemarspiguet') ||
         s.includes('royal-oak') || s.includes('offshore') || s.includes('code-1159') ||
         s.includes('watch');
}
function widthHint(u){
  const s = String(u||'').toLowerCase();
  let score = 0;
  const m1 = s.match(/[?&](wid|w|width)=(\d+)/);                if (m1) score += +m1[2];
  const m2 = s.match(/[?&]size=(\d{3,4})(?:[,x](\d{3,4}))?/);   if (m2) score += +m2[1];
  const m3 = s.match(/(\d{3,4})x(\d{3,4})/);                    if (m3) score += +m3[1];
  if (/\.(jpe?g)(\?|$)/.test(s)) score += 200;
  if (/\.(webp|avif)(\?|$)/.test(s)) score += 150;
  score += Math.min(s.length/10,200);
  if (isBad(s)) score -= 1000;
  return score;
}
function pickBest(cands){
  const uniq = Array.from(new Set((cands||[]).filter(Boolean)));
  const pool = uniq.filter(u => isLikelyWatch(u));
  const best = pool.map(url => ({ url, score: widthHint(url) }))
                   .sort((a,b)=>b.score-a.score)[0];
  return best ? best.url : '';
}

async function downloadBuffer(url){
  const res = await fetch(url, {
    redirect:'follow',
    headers:{
      'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      'Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': new URL(url).origin
    }
  });
  if(!res.ok) throw new Error(`Image download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
async function uploadToCloudinary(buffer, publicId){
  return new Promise((resolve,reject)=>{
    cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, resource_type:'image', format:'jpg' },
      (err, result)=> err ? reject(err) : resolve(result)
    ).end(buffer);
  });
}

// ---------- debug ----------
function makeDebugger(dir, enabled){
  ensureDir(dir);
  const logPath = path.join(dir,'debug.log');
  const write = (line)=>{ try{ ensureDir(dir); fs.appendFileSync(logPath, `${new Date().toISOString()}  ${line}\n`,'utf8'); }catch{} };
  return {
    enabled, dir,
    log: (line)=> enabled && write(line),
    async snapshot(page,label){
      if(!enabled) return;
      try{
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, `${label}.html`), await page.content(),'utf8');
        await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage:true });
      }catch(e){ write(`snapshot ${label}: ${e.message}`); }
    },
    async saveCandidates(cands, name){
      if(!enabled) return;
      try{
        ensureDir(dir);
        const txt = (cands||[]).map(u=>({u,s:widthHint(u)})).sort((a,b)=>b.s-a.s).map(x=>`${String(x.s).padStart(6,' ')}  ${x.u}`).join('\n');
        fs.writeFileSync(path.join(dir, name||'candidates.txt'), txt,'utf8');
      }catch(e){ write(`saveCandidates ${name}: ${e.message}`); }
    }
  };
}

// ---------- cookies ----------
async function ensureAcceptedCookies(page, dbg){
  const sels = [
    '#onetrust-accept-btn-handler',
    'button:has-text("Accept all cookies")',
    'button:has-text("Accept All")',
    '[role="button"]:has-text("Accept")',
    'a:has-text("Accept all cookies")',
  ];
  const deadline = Date.now()+12000;
  while(Date.now()<deadline){
    let clicked=false;
    for(const s of sels){
      try{
        const btn = page.locator(s).first();
        if(await btn.count()){ await btn.click({timeout:800}).catch(()=>{}); clicked=true; await page.waitForTimeout(300); }
      }catch{}
    }
    if(clicked){
      const hidden = await page.evaluate(()=>{
        const b=document.querySelector('#onetrust-banner-sdk'); if(!b) return true;
        const st=getComputedStyle(b); return st.display==='none'||st.visibility==='hidden'||st.opacity==='0';
      }).catch(()=>true);
      if(hidden){ dbg?.log('Cookie banner dismissed.'); return; }
    }
    for(const f of page.frames()){
      try{
        const b=f.locator('button:has-text("Accept")').first();
        if(await b.count()) await b.click({timeout:800}).catch(()=>{});
      }catch{}
    }
    await page.waitForTimeout(350);
  }
}

// ---------- ref helpers ----------
const findRefInString = s => (String(s||'').match(REF_RE)||[])[1]||'';
function refFromUrlAnywhere(u){ try{ return findRefInString(new URL(u).href)||''; }catch{ return ''; } }
async function refFromDom(page){
  const h = await page.evaluate(()=>({
    canonical: document.querySelector('link[rel="canonical"]')?.href||'',
    ogUrl: document.querySelector('meta[property="og:url"]')?.content||'',
    text: document.body?.innerText||'',
  }));
  return findRefInString(h.canonical)||findRefInString(h.ogUrl)||findRefInString(h.text)||'';
}

// ---------- Price extraction ----------
function toNumberLike(s){
  if(!s) return null;
  const raw=String(s).replace(/[^\d.,']/g,'');
  const noThousand=raw.replace(/['.,](?=\d{3}\b)/g,'');
  const n=parseFloat(noThousand.replace(/,/g,'.'));
  return isNaN(n)?null:n;
}
async function extractPriceNormalized(page, dbg){
  const meta = await page.evaluate(()=>({
    amt: document.querySelector('meta[property="product:price:amount"]')?.content ||
         document.querySelector('meta[itemprop="price"]')?.content ||
         document.querySelector('meta[name="price"]')?.content || '',
    cur: document.querySelector('meta[property="product:price:currency"]')?.content ||
         document.querySelector('meta[itemprop="priceCurrency"]')?.content ||
         document.querySelector('meta[name="priceCurrency"]')?.content || ''
  }));
  if(meta.amt){
    const amount=toNumberLike(meta.amt);
    const currency=(meta.cur|| (meta.amt.includes('$')?'USD':'')).toUpperCase()||'USD';
    const formatted = currency==='USD' && amount!=null ? `$${amount.toLocaleString('en-US')}` : `${currency} ${meta.amt}`;
    return { formatted, currency, amount: amount??null };
  }

  const fromLD = await page.evaluate(()=>{
    try{
      const blocks=[...document.querySelectorAll('script[type="application/ld+json"]')];
      for(const b of blocks){
        const d=JSON.parse(b.textContent||'null');
        const arr=Array.isArray(d)?d:[d];
        for(const x of arr){
          if(!x||typeof x!=='object') continue;
          const offer=x.offers||x.Offer||x.offer;
          const price=offer?.price||offer?.priceSpecification?.price;
          if(price){
            const currency=(offer.priceCurrency||offer.priceSpecification?.priceCurrency||'').toUpperCase();
            return { amount:String(price), currency };
          }
        }
      }
    }catch{}
    return null;
  });
  if(fromLD){
    const amount=toNumberLike(fromLD.amount);
    const currency=(fromLD.currency||'').toUpperCase()||'USD';
    const formatted = currency==='USD' && amount!=null ? `$${amount.toLocaleString('en-US')}` : `${currency} ${fromLD.amount}`;
    return { formatted, currency, amount: amount??null };
  }

  const textHit = await page.evaluate(()=>{
    function norm(s){ return (s||'').replace(/\s+/g,' ').trim(); }
    const rx=/(USD|CHF|EUR|€|\$)\s*[0-9][0-9'.,\s]*/i;
    const prefer=[...document.querySelectorAll('[class*="price" i],[id*="price" i]')].map(el=>({el,txt:norm(el.textContent||'')})).filter(x=>rx.test(x.txt));
    if(prefer.length) return prefer[0].txt.match(rx)?.[0]||'';
    const cands=[...document.querySelectorAll('body *')].slice(0,8000).map(el=>{
      const cs=getComputedStyle(el); const r=el.getBoundingClientRect(); const txt=norm(el.textContent||'');
      const looks=rx.test(txt); const vis=cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>20&&r.height>10;
      return { txt, area:r.width*r.height, vis, looks };
    }).filter(x=>x.vis&&x.looks).sort((a,b)=>b.area-a.area);
    return cands[0]?.txt.match(rx)?.[0]||'';
  });
  if(textHit){
    const hasUSD=/USD/i.test(textHit), hasDollar=/\$/i.test(textHit);
    const amount=toNumberLike(textHit);
    const currency = hasUSD?'USD':(hasDollar?'USD':'');
    if(currency==='USD' && amount!=null) return { formatted:`$${amount.toLocaleString('en-US')}`, currency:'USD', amount };
    if(amount!=null) return { formatted:`${currency||''} ${textHit}`.trim(), currency:currency||'N/A', amount };
  }
  dbg?.log('Price not found.');
  return { formatted:'N/A', currency:'N/A', amount:null };
}

// ---------- Calibre ----------
async function extractCalibreBlock(page, dbg){
  try{
    const tab=page.locator('a:has-text("Calibre"), button:has-text("Calibre")').first();
    if(await tab.count()){ await tab.click({timeout:2000}).catch(()=>{}); await page.waitForTimeout(700); }
  }catch{}
  await dbg.snapshot(page,'calibre_tab');

  const result = await page.evaluate(()=>{
    function norm(s){ return (s||'').replace(/\s+/g,' ').trim(); }
    function qAll(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

    const heading=qAll('h1,h2,h3,h4,h5,h6').find(h=>/\bCALIBRE\b/i.test(norm(h.textContent||'')));
    const section=heading ? (heading.closest('section,article,div') || heading.parentElement) : null;

    function pick(label){
      const root=section||document, els=qAll('*',root);
      const lab=els.find(e=>new RegExp(`^\\s*${label}\\s*$`,'i').test((e.textContent||'').trim()));
      if(lab){ let n=lab.nextElementSibling; while(n && !norm(n.textContent)) n=n.nextElementSibling; if(n) return norm(n.textContent); }
      return 'N/A';
    }

    function abs(u){ try{ return new URL(u, location.href).href; }catch{ return ''; } }

    function bestImage(){
      const anchor = heading || section || document.body;
      const aRect = anchor.getBoundingClientRect();
      const aCx=aRect.left + aRect.width/2, aCy=aRect.top + aRect.height/2;

      const imgs = qAll('img', section||document)
        .filter(img=>{
          const cs=getComputedStyle(img); const r=img.getBoundingClientRect();
          return cs.display!=='none' && cs.visibility!=='hidden' && r.width>50 && r.height>50;
        })
        .map(img=>{
          const r=img.getBoundingClientRect();
          const cx=r.left+r.width/2, cy=r.top+r.height/2;
          const dist=Math.hypot(cx-aCx, cy-aCy);
          const nat=(img.naturalWidth||0)*(img.naturalHeight||0);
          const src=img.currentSrc||img.src||img.getAttribute('src');
          return { src: abs(src), score: nat - dist*500 };
        })
        .sort((a,b)=>b.score-a.score);
      if(imgs[0]?.src) return imgs[0].src;

      const bg = qAll('*', section||document).map(el=>{
        const s=getComputedStyle(el).backgroundImage||''; const m=s.match(/url\(["']?(.*?)["']?\)/);
        if(!m||!m[1]) return null; return abs(m[1]);
      }).filter(Boolean)[0];
      return bg || 'N/A';
    }

    const calibre = {
      Name: (section && (section.querySelector('h1,h2,h3,h4,h5,h6')?.textContent)) ? norm(section.querySelector('h1,h2,h3,h4,h5,h6').textContent) : 'Calibre',
      Functions:     pick('Functions'),
      Mechanism:     pick('Mechanism'),
      TotalDiameter: pick('Total diameter'),
      Frequency:     pick('Frequency'),
      NumberOfJewels:pick('Number of jewels'),
      PowerReserve:  pick('Power reserve'),
      NumberOfParts: pick('Number of parts'),
      Thickness:     pick('Thickness'),
    };
    const image = bestImage();
    return { calibre, image };
  });

  if(result.image && result.image!=='N/A'){
    dbg?.saveCandidates([result.image],'calibre_image_candidates.txt');
  }
  return { cal: result.calibre, chosenCalibre: result.image || 'N/A' };
}

// ---------- Product extraction ----------
async function extractProduct(page, productUrl, opts, dbg){
  await page.goto(productUrl, { waitUntil:'networkidle', timeout:120000 }).catch(async ()=>{
    await page.goto(productUrl, { waitUntil:'domcontentloaded', timeout:120000 });
  });
  await dbg.snapshot(page,'before');
  await ensureAcceptedCookies(page, dbg);
  await page.waitForTimeout(600);
  await dbg.snapshot(page,'after_cookies');

  const urlObj = new URL(productUrl);
  const segs = urlObj.pathname.split('/').filter(Boolean);
  const idx  = segs.indexOf('watch-collection');
  const collectionSlug = segs[idx+1] || '';
  const Collection = mapCollection(collectionSlug);

  let Reference = refFromUrlAnywhere(productUrl);
  if(!Reference) Reference = await refFromDom(page);
  const Title = await page.evaluate(()=> {
    const og=document.querySelector('meta[property="og:title"],meta[name="og:title"]');
    const h1=document.querySelector('h1');
    return (og?.content || h1?.textContent || '').replace(/\s+/g,' ').trim();
  });
  if(!Reference) Reference = slugify(Title) || 'unknown';

  // ----- HERO-FIRST image selection anchored to product header/price -----
  const { heroImgs, bgImgs, metaImgs } = await page.evaluate(()=>{
    function abs(u){ try{ return new URL(u, location.href).href; }catch{ return ''; } }
    function vis(el){
      const cs=getComputedStyle(el), r=el.getBoundingClientRect();
      return cs.display!=='none' && cs.visibility!=='hidden' && r.width>60 && r.height>60;
    }

    const likeHeading = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .find(h=>/others\s+you.*like/i.test((h.textContent||'').trim()));
    const likeTopAbs = likeHeading ? (likeHeading.getBoundingClientRect().top + window.scrollY) : Infinity;

    // anchor near top (title, ref, or first price-like element)
    const header = document.querySelector('h1');
    const refEl  = Array.from(document.querySelectorAll('*')).find(e=>/^\s*Ref\.?/i.test((e.textContent||'').trim()));
    const priceEl= Array.from(document.querySelectorAll('[class*="price" i],[id*="price" i], body *')).find(e=>/\$\s*\d/.test((e.textContent||'').trim()));
    const anchors = [header, refEl, priceEl].filter(Boolean);
    const anchorY = anchors.length ? Math.min(...anchors.map(a=>a.getBoundingClientRect().top + window.scrollY)) : 0;

    const pageH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const foldY = pageH * 0.65;
    const rightEdge = window.innerWidth * 0.5;

    const heroes = Array.from(document.images)
      .filter(img=>vis(img))
      .map(img=>{
        const r=img.getBoundingClientRect(); const yAbs=r.top + window.scrollY;
        const nat=(img.naturalWidth||0)*(img.naturalHeight||0);
        const area=r.width*r.height;
        const src = abs(img.currentSrc || img.src || img.getAttribute('src') || '');
        let score = nat + area*2;
        // closeness to the header/price area = strong positive
        score -= Math.abs(yAbs - anchorY) * 1200;
        // HERO is usually on right side and above recommendations
        if(r.left > rightEdge) score += 400000;
        if(yAbs > likeTopAbs - 80) score -= 2000000; // kill "Others you might like"
        if(yAbs > foldY)          score -= 300000;
        // if alt hints at the product, nudge higher
        const alt=(img.getAttribute('alt')||'').toLowerCase();
        if(/royal|offshore|code/.test(alt)) score += 100000;
        return { src, score, area, nat, yAbs };
      })
      .filter(x => x.nat>=500*500 || x.area>=340*340)
      .sort((a,b)=>b.score-a.score)
      .map(x=>x.src);

    const bgs = Array.from(document.querySelectorAll('body *'))
      .filter(el=>vis(el))
      .map(el=>{
        const bg=getComputedStyle(el).backgroundImage||''; const m=bg.match(/url\(["']?(.*?)["']?\)/);
        if(!m||!m[1]) return null;
        const r=el.getBoundingClientRect(); const yAbs=r.top + window.scrollY;
        let score = r.width*r.height;
        score -= Math.abs(yAbs - anchorY) * 800;
        if(r.left > rightEdge) score += 200000;
        if(yAbs > likeTopAbs - 80) score -= 2000000;
        if(yAbs > foldY)          score -= 250000;
        return { src: abs(m[1]), score };
      })
      .filter(Boolean)
      .sort((a,b)=>b.score-a.score)
      .map(x=>x.src);

    const metas = new Set();
    document.querySelectorAll('meta[property="og:image"],meta[name="og:image"],meta[property="og:image:secure_url"],meta[property="twitter:image"],meta[name="twitter:image"]')
      .forEach(m=>{ const c=m.getAttribute('content'); if(c) metas.add(abs(c)); });
    document.querySelectorAll('link[rel="preload"][as="image"]').forEach(l=>{ const h=l.getAttribute('href'); if(h) metas.add(abs(h)); });
    for(const img of document.images){
      const ss=img.getAttribute('srcset'); if(ss) ss.split(',').forEach(p=>metas.add(abs(p.trim().replace(/\s+\d+w$/,''))));
    }

    return { heroImgs: heroes, bgImgs: bgs, metaImgs: Array.from(metas) };
  });

  await dbg.saveCandidates(heroImgs,'product_hero_candidates.txt');
  await dbg.saveCandidates(bgImgs,'product_bg_candidates.txt');
  await dbg.saveCandidates(metaImgs,'product_meta_candidates.txt');

  const firstGood = arr => (arr||[]).find(u => u && !isBad(u) && isLikelyWatch(u));
  let chosenProduct = firstGood(heroImgs) || firstGood(bgImgs) || pickBest(metaImgs);

  // CASE / DIAL / BRACELET
  const spec = await page.evaluate(()=>{
    function norm(s){ return (s||'').replace(/\s+/g,' ').trim(); }
    function findHeading(re){
      const tw=document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      const hits=[]; while(tw.nextNode()){ const el=tw.currentNode; const t=norm(el.textContent); if(re.test(t)) hits.push(el); }
      return hits.find(el=>/^H[1-6]$/.test(el.tagName))||hits[0]||null;
    }
    function textAfter(h){
      if(!h) return '';
      const p=h.parentElement?.querySelector('p'); if(p && norm(p.textContent)) return norm(p.textContent);
      const stop=/\b(CASE|DIAL|BRACELET|MOVEMENT|CALIBRE|WARRANTY)\b/i; let out=''; let n=h.nextElementSibling;
      while(n){ const t=norm(n.textContent); if(!t){n=n.nextElementSibling;continue;} if(stop.test(t)) break; out+=(out?' ':'')+t; n=n.nextElementSibling; }
      return out;
    }
    function extractCase(h){
      if(!h) return '';
      const root=h.closest('section,article,div')||h.parentElement;
      function pick(label){
        const els=[...root.querySelectorAll('*')];
        const lab=els.find(e=>new RegExp(`^\\s*${label}\\s*$`,'i').test((e.textContent||'').trim()));
        if(lab){ let n=lab.nextElementSibling; while(n && !(n.innerText||'').trim()) n=n.nextElementSibling; if(n) return (n.innerText||'').trim(); }
        return '';
      }
      const material=pick('Material'), size=pick('Size'), water=pick('Water resistance');
      const bits=[]; if(size) bits.push(size); if(material) bits.push(material); if(water) bits.push(`Water resistance ${water}`);
      return bits.length? bits.join(', ') : textAfter(h);
    }
    const c=findHeading(/^\s*CASE\s*$/i), d=findHeading(/^\s*DIAL\s*$/i), b=findHeading(/^\s*BRACELET\s*$/i);
    return { Case: extractCase(c), Dial: textAfter(d), Bracelet: textAfter(b) };
  });

  // normalize case via dataLayer
  const dl = await page.evaluate(()=>{
    const arr=Array.isArray(window.dataLayer)?window.dataLayer:[];
    const m=Object.assign({}, ...arr.filter(o=>o&&typeof o==='object'));
    return { size:m.productCaseSize||m.product_size||'', material:m.productCaseMaterial||m.product_material||'', water:m.productWaterResistance||m.product_water_resistance||'' };
  }).catch(()=>({}));

  const parts=[]; const add=(p)=>{ if(p && !parts.some(x=>x.toLowerCase()===p.toLowerCase())) parts.push(p); };
  if(dl.size) add(`${dl.size} mm`); if(dl.material) add(dl.material);
  if(dl.water){ const m=String(dl.water).match(/(\d{2,3})/); add(`Water resistance ${m?m[1]+' m':dl.water}`); }
  if(spec.Case){
    const mm=spec.Case.match(/(\d{2,3})\s*mm/i);    if(mm) add(`${mm[1]} mm`);
    const wr=spec.Case.match(/(\d{2,3})\s*m\b/i);   if(wr) add(`Water resistance ${wr[1]} m`);
    const mat=spec.Case.match(/(18-?carat[^,.;]*)/i); if(mat) add(mat[1].replace(/\s+/g,' ').trim());
    if(parts.length===0) add(spec.Case);
  }
  const caseStr=parts.join(', ');

  // Calibre + Price
  const { cal, chosenCalibre } = await extractCalibreBlock(page, dbg);
  const price = await extractPriceNormalized(page, dbg);

  // finalize entry
  const entry = {
    Reference,
    Brand:'Audemars Piguet',
    Collection,
    Description: Title,
    Details: caseStr,
    Specs:(()=>{ const o={}; const mm=caseStr.match(/(\d{2,3})\s*mm/i); if(mm) o.case_diameter_mm=+mm[1]; const wr=caseStr.match(/(\d{2,3})\s*m\b/i); if(wr) o.water_resistance_m=+wr[1]; return o; })(),
    Case: caseStr||'',
    Dial: spec.Dial||'',
    Bracelet: spec.Bracelet||'',
    Price: price.formatted||'N/A',
    PriceCurrency: price.currency||'N/A',
    PriceAmount: price.amount??null,
    ImageFilename:'',
    Calibre: { ...cal, Image: chosenCalibre || 'N/A' },
    SourceURL: productUrl,
    Aliases: [],
    LastUpdated: new Date().toISOString().slice(0,10)
  };

  // upload product image
  if(chosenProduct){
    if(opts.upload){
      const buf=await downloadBuffer(chosenProduct);
      const res=await uploadToCloudinary(buf, `ap/${slugify(Collection||'misc')}/${entry.Reference}`);
      entry.ImageFilename=res.secure_url;
    }else entry.ImageFilename=chosenProduct;
  }

  // upload calibre image
  if(entry.Calibre.Image && entry.Calibre.Image!=='N/A'){
    if(opts.upload){
      const buf=await downloadBuffer(entry.Calibre.Image);
      const res=await uploadToCloudinary(buf, `ap/${slugify(Collection||'misc')}/calibres/${entry.Reference}`);
      entry.Calibre.Image=res.secure_url;
    }
  }else entry.Calibre.Image='N/A';

  // coerce empty strings in Calibre to N/A
  entry.Calibre = Object.fromEntries(Object.entries(entry.Calibre).map(([k,v])=>[k, v && String(v).trim()? v : 'N/A']));

  return entry;
}

(async function main(){
  const args=process.argv.slice(2);
  const url=args[0];
  if(!url || !/^https?:\/\//i.test(url)){
    console.error('Usage: node scripts/scrapeAPProduct.js "<FULL_PRODUCT_URL>" [--upload] [--write] [--headless] [--debug] [--trace] [--clear-state]');
    process.exit(1);
  }
  const upload   = args.includes('--upload');
  const write    = args.includes('--write');
  const headless = args.includes('--headless');
  const debug    = args.includes('--debug');
  const trace    = args.includes('--trace');
  const clear    = args.includes('--clear-state');

  ensureDir(STATE_DIR);
  if(clear && fs.existsSync(STATE_PATH)){ fs.unlinkSync(STATE_PATH); console.log('Cleared cookie/storage state:', STATE_PATH); }

  const defaultName=(new URL(url).pathname.split('/').pop()||String(Date.now())).replace(/\.html?$/,'');
  const tmpRoot=path.join(process.cwd(),'tmp','ap_debug'); ensureDir(tmpRoot);
  const tmpDir=path.join(tmpRoot, defaultName);
  const dbg=makeDebugger(tmpDir, debug);
  if(debug) console.log('Debug artifacts:', tmpDir);

  const browser=await chromium.launch({ headless: headless ? true : !process.env.HEADFUL });
  const context=await browser.newContext({
    storageState: fs.existsSync(STATE_PATH)?STATE_PATH:undefined,
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
    viewport:{ width:1440, height:900 },
    locale:'en-US',
    timezoneId:'America/Chicago',
    extraHTTPHeaders:{ 'Accept-Language':'en-US,en;q=0.9' },
  });

  if(debug){
    context.on('page',(pg)=>{
      pg.on('console',(m)=>dbg.log(`[console:${m.type()}] ${m.text()}`));
      pg.on('requestfailed',(req)=>dbg.log(`[requestfailed] ${req.failure()?.errorText||'csp'}  ${req.method()} ${req.url()}`));
      pg.on('response',(res)=>{ const s=res.status(); if(s>=400) dbg.log(`[response ${s}] ${res.url()}`); });
    });
  }
  if(trace) await context.tracing.start({ screenshots:true, snapshots:true, sources:true });

  const page=await context.newPage();

  try{
    const entry=await extractProduct(page, url, { upload, debug }, dbg);
    await context.storageState({ path: STATE_PATH });

    console.log('\nExtracted:');
    console.log({
      Reference: entry.Reference,
      Brand: entry.Brand,
      Collection: entry.Collection,
      Description: entry.Description,
      Case: entry.Case,
      Dial: entry.Dial,
      Bracelet: entry.Bracelet,
      Price: entry.Price,
      PriceCurrency: entry.PriceCurrency,
      PriceAmount: entry.PriceAmount,
      ImageFilename: entry.ImageFilename,
      Calibre: entry.Calibre
    });

    if(write){
      ensureDir(DATA_DIR);
      const list=loadJson(DATA_PATH);
      const i=list.findIndex(x=>(x.Reference||'')===entry.Reference);
      if(i===-1) list.push(entry); else list[i]={ ...list[i], ...entry, LastUpdated:new Date().toISOString().slice(0,10) };
      saveJson(DATA_PATH, list.sort((a,b)=>a.Reference.localeCompare(b.Reference)));
      console.log(`\nUpdated ${DATA_PATH}`);
    }

    if(trace){
      ensureDir(dbg.dir);
      await context.tracing.stop({ path: path.join(dbg.dir,'trace.zip') });
      console.log('Saved Playwright trace:', path.join(dbg.dir,'trace.zip'));
    }
  }catch(err){
    try{ ensureDir(dbg.dir); await page.screenshot({ path: path.join(dbg.dir,'fail.png'), fullPage:true }); }catch{}
    try{ ensureDir(dbg.dir); fs.writeFileSync(path.join(dbg.dir,'fail.html'), await page.content(),'utf8'); }catch{}
    console.error('ERROR:', err.message);
    console.error(`Debug saved in ${dbg.dir}`);
    process.exit(1);
  }finally{
    await browser.close();
  }
})();
