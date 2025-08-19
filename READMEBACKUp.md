# Watch LookUp / Fine Watches — Project Guide

_Last updated: **2025-08-13**_

This repository hosts the **Watch LookUp** app (a.k.a. *Fine Watches*): a static front-end served by Netlify with Node/Netlify Functions for data access to MongoDB Atlas. This README captures **everything needed to run, develop, and deploy**—so you can drop it into a new chat and hit the ground running.

---

## 1) Tech Stack & Overview

- **Frontend:** vanilla HTML/CSS/JS (no framework)
- **Hosting:** Netlify
- **Functions:** Netlify Functions (Node 18+, bundled with `esbuild`)
- **Database:** MongoDB Atlas (cluster: `patek-cluster`)
- **Images:** Cloudinary
- **Local tooling:** Netlify CLI (optional), mongosh (optional), Node.js 22.x

Main user flow:
1. User enters text in **one unified search** (`combinedSearchInput`).
2. Frontend calls `/.netlify/functions/greyMarketLookup?term=...`.
3. Function queries **MongoDB** (fields: `Model`, `Model Name`, `Nickname or Dial`), sorts by **Date Entered (desc)**, returns JSON.
4. Frontend renders results (desktop card layout or mobile table) and supports editing/saving entries via `updateGreyMarket` function (with optional Cloudinary image upload).

---

## 2) Repository Layout

```
.
├─ src/                       # Front-end (published on Netlify)
│  ├─ index.html
│  ├─ main.js
│  ├─ style.css
│  └─ assets/                 # logos + watch images (heavy; generally not backed up)
│     └─ grey_market/...
│
├─ functions/                 # Netlify Functions (serverless)
│  ├─ greyMarketLookup.js     # unified search (Model, Model Name, Nickname or Dial)
│  ├─ updateGreyMarket.js     # update/edit entries (also used by form)
│  ├─ addgreyMarket.js        # add an entry (not changed by unified search)
│  ├─ deleteGreyMarket.js     # delete an entry
│  └─ referenceLookUp.js      # NEW: AP references search (partial matches on Reference/Brand/Collection/Description)
│
├─ scripts/
│  ├─ importNewRows.js        # CSV → MongoDB importer + Cloudinary upload logic
│  ├─ scrapeAPProduct.js      # NEW: scrape one AP product page → references.json (+ optional Cloudinary)
│  ├─ crawlAP.js              # NEW: crawl AP collections → scrape many products
│  └─ loadReferencesToMongo.js# NEW: load data/references.json → MongoDB (upsert)
│
├─ data/
│  ├─ references.json         # NEW: AP references data (built by scraper/crawler)
│  ├─ data.csv
│  ├─ grey_market_refs.csv
│  └─ Fine Watch Tracking.csv
│
├─ netlify.toml               # Netlify config (publish + functions paths)
├─ package.json
├─ package-lock.json
├─ .gitignore                 # excludes .env, src/assets, data/, backup/, etc.
├─ .env                       # local dev only (never commit)
└─ backup.bat                 # snapshot script (excludes src\assets)
```

> **Netlify config (`netlify.toml`)**
>
> ```toml
> [build]
>   publish   = "src"
>   functions = "functions"
>
> [functions]
>   node_bundler = "esbuild"
> ```

---

## 3) Environment Variables

Set these in **Netlify → Site settings → Environment variables** (production) and/or `.env` (local). **Do not commit `.env`.**

| Name                     | Example / Notes                                                                 |
|--------------------------|----------------------------------------------------------------------------------|
| `MONGO_URI`              | `mongodb+srv://<user>:<pass>@patek-cluster.rchgesl.mongodb.net/admin?...`       |
| `MONGO_DB`               | `test` (default) or your DB name (e.g., `patek_db`, `watchlookup`)              |
| `MONGO_COLL`             | `grey_market_refs` (GM) — the references function uses its own collection name  |
| `MONGO_REF_COLL`         | **NEW**: `references` (AP references)                                           |
| `CLOUDINARY_CLOUD_NAME`  | Your Cloudinary cloud name                                                      |
| `CLOUDINARY_API_KEY`     | Cloudinary API key                                                              |
| `CLOUDINARY_API_SECRET`  | Cloudinary API secret                                                           |

> ✅ Keep two Mongo users if helpful (e.g., one full-access and one read/write). For local scripts, select the proper `MONGO_URI` in `.env`. For production, Netlify’s env var takes precedence.

---

## 4) Unified Search (Frontend + Function)

### Frontend (`src/main.js`)
- Reads from `#combinedSearchInput`.
- Calls `/.netlify/functions/greyMarketLookup?term=...`.
- Sorts results **newest → oldest** by `"Date Entered"` as a safeguard (server also sorts).
- Renders desktop **cards** or mobile **table** with sortable columns.
- Provides image modal, basic editing form, and save via `updateGreyMarket`.

**Client-side date parsing** supports `MM/DD/YYYY` and `YYYY-MM-DD`.

### Function (`functions/greyMarketLookup.js`)
- Validates `term`.
- Builds case-insensitive `$or` regex query over:
  - `Model`
  - `Model Name`
  - `Nickname or Dial`
- Connects using `MONGO_URI`, DB = `MONGO_DB`, Coll = `MONGO_COLL`.
- Sorts by `"Date Entered"` descending.
- Returns an array of documents.

---

## 5) Edit / Save Flow (Cloudinary)

- Editing can upload to **Cloudinary** (unsigned preset).
- The returned `secure_url` is saved in Mongo (`ImageFilename`).
- `updateGreyMarket` expects `{ uniqueId, fields }` and updates by `"Unique ID"`.

---

## 6) CSV Import Script

`node scripts/importNewRows.js`

- Loads env vars, connects to MongoDB.
- Reads `data/grey_market_refs.csv`.
- Optionally uploads images to Cloudinary (`grey_market/`).
- Upserts each row into Mongo by `"Unique ID"` (idempotent).

---

## 7) Local Development (Optional)

**Prereqs**
- Node.js ≥ 18 (using 22.x now)
- Netlify CLI

**Run**
```bash
netlify dev
```
- Static site at http://localhost:8888
- Functions proxied under `/.netlify/functions/*`

**Invoke a function directly**
```bash
netlify functions:list
netlify functions:invoke greyMarketLookup --querystring "term=Daytona"
```

---

## 8) Deployment

**One-time**
- Connect Netlify site to this repo.
- Set env vars in Netlify.

**Standard**
```bash
git add .
git commit -m "Update"
git pull --rebase origin main
git push origin main
```

---

## 9) Troubleshooting (GM / site)

- If UI shows “Searching…”: check Network for `/.netlify/functions/greyMarketLookup?...` → 200 + JSON.
- If results don’t render: ensure `renderGreyMarketResults(data)` is called and no JS errors occur.
- Ensure `netlify.toml` has `publish="src"` and `functions="functions"`.

---

## 10) Security & Git Hygiene

- Never commit `.env`.
- `.gitignore` includes: `.env*`, `.netlify/`, `node_modules/`, `backup/`, `src/assets/`, `data/`, etc.

---

## 11) Backup Script (Windows)

`backup.bat` snapshots code and config (excludes heavy `src\assets`).

---

## 12) Quick Start (TL;DR)

1. Netlify env: `MONGO_URI`, `MONGO_DB`, `MONGO_COLL`, `CLOUDINARY_*`.
2. Confirm `netlify.toml` paths.
3. `git add/commit/push`.
4. Search GM; newest results appear first.
5. Use Netlify **Functions logs** and browser devtools for debugging.

---

## 13) Useful Commands

```bash
# Local
netlify dev
netlify functions:list
netlify functions:invoke greyMarketLookup --querystring "term=Daytona"

# Import CSV → Mongo + upload images
node scripts/importNewRows.js
```

---

## 14) Notes & Conventions

- Dates: `MM/DD/YYYY` and `YYYY-MM-DD`.
- Images: absolute (Cloudinary) or relative (`assets/grey_market/...`).

---

## 15) AP Reference Data Pipeline (NEW)

This pipeline crawls Audemars Piguet product pages, **extracts references + specs**, uploads canonical images to Cloudinary, writes **`data/references.json`**, and **loads** the data into MongoDB (`references` collection). It enables a **separate Reference Lookup** (partial match on references like `15210OR`).

### 15.1 Data model (Mongo: `references`)

Each document (typical shape):

```json
{
  "Reference": "26398BC.OO.D002CR.02",
  "Brand": "Audemars Piguet",
  "Collection": "Code 11.59",
  "Description": "Code 11.59 by Audemars Piguet - 26398BC.OO.D002CR.02 - Audemars Piguet",
  "Details": "42 mm, 18-carat white gold, Water resistance 20 m",
  "Specs": { "case_diameter_mm": 42, "water_resistance_m": 20 },
  "Case": "42 mm, 18-carat white gold",
  "Dial": "18 carat white gold and NAC dial, ...",
  "Bracelet": "Black alligator strap with 18 carat white gold AP folding clasp.",
  "Price": "41,100",
  "PriceCurrency": "USD",
  "PriceAmount": 41100,
  "ImageFilename": "https://res.cloudinary.com/<cloud>/image/upload/v.../ap/code-11-59/26398BC.OO.D002CR.02.jpg",
  "Calibre": {
    "Name": "Calibre 1000",
    "Functions": "Grande Sonnerie Supersonnerie, minute repeater, ...",
    "Mechanism": "Selfwinding",
    "TotalDiameter": "34.3 mm",
    "Frequency": "3 hz 21600 vph",
    "NumberOfJewels": "90",
    "PowerReserve": "60 h",
    "NumberOfParts": "1155",
    "Thickness": "9.1 mm",
    "Image": "https://res.cloudinary.com/<cloud>/image/upload/v.../ap/code-11-59/calibres/26398BC.OO.D002CR.02.jpg"
  },
  "SourceURL": "https://www.audemarspiguet.com/.../26398BC.OO.D002CR.02.html",
  "Aliases": [],
  "LastUpdated": "2025-08-13"
}
```

> Notes
> - Image public IDs: `ap/<collection-slug>/<Reference>.jpg` and `ap/<collection-slug>/calibres/<Reference>.jpg`.
> - Collection slug is derived from URL segment (e.g., `code-1159`, `royal-oak-offshore`).

---

## 16) Scrape a Single Product (NEW)

**Script:** `scripts/scrapeAPProduct.js`  
**Purpose:** Load one AP product URL, **accept cookies**, pick the correct **hero image** (not cross-sell), parse **CASE/DIAL/BRACELET**, **Calibre** tab, **price** (USD when available), upload images to Cloudinary (optional), and **append/update** `data/references.json`.

**Examples**
```bash
# Headful (set env to see browser), write JSON, upload to Cloudinary, save debug artifacts
set HEADFUL=1 && node scripts\scrapeAPProduct.js "https://www.audemarspiguet.com/com/en/watch-collection/code-1159/26398BC.OO.D002CR.02.html" --write --upload --debug

# Headless quick scrape (no upload)
node scripts/scrapeAPProduct.js "https://www.audemarspiguet.com/com/en/watch-collection/royal-oak-offshore/26238ST.OO.A340CA.01.html" --write
```

**Flags**
- `--write` updates `data/references.json` (upsert by `Reference`)
- `--upload` pushes images to Cloudinary
- `--debug` saves `tmp/ap_debug/<Reference>/` with `before.html`, `after_cookies.html`, `after_extract.html`, screenshots, and candidate image lists
- `--clear-state` resets the Playwright storage state to re-accept cookies

> **Tips**
> - If you see a wrong image (e.g., from “Others you might like”), the script biases the **hero render**. If AP changes markup again, adjust the **hero selectors list** or **cookie selectors** first.
> - Cookies: the script proactively clicks common “Accept all cookies” selectors and Onetrust variants.

---

## 17) Crawl Collections (NEW)

**Script:** `scripts/crawlAP.js`  
**Purpose:** Discover and scrape many products from AP collections.

**Examples**
```bash
# Crawl Code 11.59 family
set HEADFUL=1 && npm run ap:crawl:code1159

# Crawl Royal Oak Offshore family
set HEADFUL=1 && npm run ap:crawl:offshore

# Crawl all supported collections
set HEADFUL=1 && npm run ap:crawl:all
```

**Recommended npm scripts (package.json)**
```jsonc
{
  "scripts": {
    "playwright:install": "playwright install chromium",
    "ap:scrape": "node scripts/scrapeAPProduct.js",
    "ap:crawl:all": "node scripts/crawlAP.js --all --write --upload --resume --concurrency=2 --delay=2500",
    "ap:crawl:offshore": "node scripts/crawlAP.js --collections=royal-oak-offshore --write --upload --resume --concurrency=2 --delay=2500",
    "ap:crawl:code1159": "node scripts/crawlAP.js --collections=code-1159 --write --upload --resume --concurrency=2 --delay=2500"
  }
}
```

> **Debugging**
> - Use `--debug` to capture artifacts per product.
> - Use `--resume` to continue from a previous run.
> - If AP changes markup, bump the **hero selectors list** or **cookie selectors** first.

---

## 18) Load References into Mongo (NEW)

**Script:** `scripts/loadReferencesToMongo.js`  
**Purpose:** Upsert `data/references.json` → MongoDB (`references` collection), ensuring index on `Reference` (unique).

**Run**
```bash
# Ensure MONGO_URI is the user/DB you intend to use (and not forced to /admin unless desired)
node scripts/loadReferencesToMongo.js
```

**.env pointers**
```dotenv
MONGO_URI="mongodb+srv://<USER>:<PASS>@patek-cluster.rchgesl.mongodb.net/patek_db?retryWrites=true&w=majority"
MONGO_DB="patek_db"
MONGO_REF_COLL="references"
```

> If you ever get an Atlas “Unauthorized on admin” error, confirm:
> - The **pathname DB** in your URI is correct (e.g., `/patek_db`, not `/test` or `/admin`)
> - The user has **readWrite** on that DB.  
> - You aren’t unintentionally overriding `MONGO_DB` with a different value at runtime.

---

## 19) Reference Lookup API (NEW)

**Function:** `functions/referenceLookUp.js`

**HTTP**
```
GET /.netlify/functions/referenceLookUp?q=<term>&limit=50
```

**Behavior**
- Case-insensitive **partial match** across:  
  - `Reference` (e.g., `15210OR`)
  - `Brand` (e.g., `Audemars Piguet`)
  - `Collection` (e.g., `Code 11.59`, `Royal Oak Offshore`)
  - `Description` text
- Returns an array of documents (subset of fields by default).  
- Uses env: `MONGO_URI`, `MONGO_DB`, `MONGO_REF_COLL` (default `references`).

**Example**
```bash
curl "http://localhost:8888/.netlify/functions/referenceLookUp?q=15210OR&limit=50"
```

---

## 20) Wire the Reference UI (NEW)

> You restored `src/index.html` and `src/main.js` to pre-session backups. Keep them intact for GM. To add **Reference Lookup** without impacting existing GM flows, wire a **separate input/button** to call the new function.

1) **HTML controls** (ensure these IDs exist in your restored `index.html`):
```html
<input id="refQuery" placeholder="Enter reference (e.g., 15210OR)" />
<button id="refLookupBtn">Reference Lookup</button>
<div id="refResults"></div>
```

2) **Front-end hook** (append to `src/main.js`):
```js
async function doReferenceLookup() {
  const q = document.getElementById('refQuery').value.trim();
  const out = document.getElementById('refResults');
  out.innerHTML = '';
  if (!q) { out.textContent = 'Enter a reference or keywords'; return; }

  out.textContent = 'Searching references…';
  try {
    const res = await fetch(`/.netlify/functions/referenceLookUp?q=${encodeURIComponent(q)}&limit=50`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      out.textContent = `No results for “${q}”.`;
      return;
    }
    out.innerHTML = data.map(d => `
      <div class="card" style="margin:10px 0;padding:12px;border:1px solid gold;border-radius:10px">
        <div><strong>${d.Reference || ''}</strong> — ${d.Brand || ''} ${d.Collection ? ' | ' + d.Collection : ''}</div>
        <div>${d.Description || ''}</div>
        ${d.ImageFilename ? `<img src="${d.ImageFilename}" style="max-width:200px;margin-top:8px;border-radius:8px" />` : ''}
        ${d.Calibre?.Name ? `<div style="margin-top:8px"><em>${d.Calibre.Name}</em></div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    out.textContent = 'Error fetching references.';
  }
}
document.getElementById('refLookupBtn')?.addEventListener('click', doReferenceLookup);
```

> Styling: reuse your existing dark theme; the above uses simple inline card styles to stay self-contained.

---

## 21) Run-All Flow (End-to-End)

1. **Scrape** a few pages (or crawl a family)  
   - `set HEADFUL=1 && npm run ap:crawl:code1159`  
   - Results accumulate in `data/references.json`
2. **Load** references into Mongo  
   - `node scripts/loadReferencesToMongo.js`
3. **Wire UI** (just once) & test locally  
   - `netlify dev` → open http://localhost:8888  
   - Use the new Reference Lookup UI; try partials like `15210OR`
4. **Deploy**  
   - `git add . && git commit -m "Add AP reference pipeline + UI" && git push`

---

## 22) Troubleshooting (AP pipeline)

- **Cookie banner not dismissed:** re-run with `--clear-state` or headful and click once; future runs reuse the saved state.
- **Wrong image chosen:** the scraper now prefers the **hero render**. If AP changes markup again, adjust the **hero selectors list** in `scrapeAPProduct.js`.
- **No Calibre image:** not all pages have calibre imagery; we store `Calibre.Image = ""` (or `N/A`).
- **Price variance:** the script captures USD when present. If a country/locale blocks price, you’ll see `Price` omitted or `N/A`.
- **Atlas “Unauthorized on admin”:** ensure the **URI DB name** path is correct and the user has `readWrite` on that DB (not only `admin`), and that your app uses `MONGO_DB` consistently.

---

Happy building!
