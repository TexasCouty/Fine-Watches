# Watch LookUp / Fine Watches — Project Guide

_Last updated: **2025-08-12 23:53:05 UTC**_

This repository hosts the **Watch LookUp** app (a.k.a. *Fine Watches*): a static front‑end served by Netlify with Node/Netlify Functions for data access to MongoDB Atlas. This README captures **everything needed to run, develop, and deploy**—so you can drop it into a new chat and hit the ground running.

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
│  └─ deleteGreyMarket.js     # delete an entry
│
├─ scripts/
│  └─ importNewRows.js        # CSV → MongoDB importer + Cloudinary upload logic
│
├─ data/                      # Local CSVs used by importer (NOT deployed)
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
| `MONGO_DB`               | `test` (default)                                                                |
| `MONGO_COLL`            | `grey_market_refs`                                                               |
| `CLOUDINARY_CLOUD_NAME`  | Your Cloudinary cloud name                                                      |
| `CLOUDINARY_API_KEY`     | Cloudinary API key                                                              |
| `CLOUDINARY_API_SECRET`  | Cloudinary API secret                                                           |

> ✅ You can maintain multiple DB users in Atlas (e.g., `Greymarket`). For local scripts, select the right `MONGO_URI` by editing `.env`. For production, Netlify’s env var takes precedence.

---

## 4) Unified Search (Frontend + Function)

### Frontend (`src/main.js`)
- Reads from `#combinedSearchInput`.
- Calls `/.netlify/functions/greyMarketLookup?term=...`.
- Sorts results **newest → oldest** by `"Date Entered"` as a safeguard (server also sorts).
- Renders desktop **cards** or mobile **table** with sortable columns.
- Provides image modal, basic editing form, and save via `updateGreyMarket`.

**Client-side date parsing used by sorting** supports `MM/DD/YYYY` and `YYYY-MM-DD`.

### Function (`functions/greyMarketLookup.js`)
- Validates `term`.
- Builds case-insensitive `$or` regex query over these fields:
  - `Model`
  - `Model Name`
  - `Nickname or Dial`
- Connects using `MONGO_URI`, DB = `MONGO_DB` (default `test`), Coll = `MONGO_COLL` (default `grey_market_refs`).
- Sorts by `"Date Entered"` descending (server-side normalization then sort).
- Returns an array of documents.

Example of the query shape:
```js
const q = {{
  $or: [
    {{ Model: {{ $regex: term, $options: 'i' }} }},
    {{ 'Model Name': {{ $regex: term, $options: 'i' }} }},
    {{ 'Nickname or Dial': {{ $regex: term, $options: 'i' }} }}
  ]
}};
```

---

## 5) Edit / Save Flow (Cloudinary)

- When editing an entry, if an image is chosen, the frontend uploads to **Cloudinary** via unsigned preset.
- The returned `secure_url` is stored in Mongo (`ImageFilename`). If an existing HTTP(S) URL is present, it is reused.
- `updateGreyMarket` function expects a body with `{ uniqueId, fields }` and performs an update by `"Unique ID"`.

---

## 6) CSV Import Script

`node scripts/importNewRows.js`

- Loads env vars, connects to MongoDB.
- Reads `data/grey_market_refs.csv`.
- For each row:
  - Attempts to upload `{{Unique ID}}-001.jpg` from either `src/assets/grey_market/` (or legacy path) to **Cloudinary** (folder `grey_market`), reusing the URL if already present.
  - Upserts into MongoDB by `"Unique ID"` (updates all fields if found, inserts if new).
- **Idempotent**: Skips re-uploading images that already exist in Cloudinary.

> **Tip:** Ensure your `CLOUDINARY_*` env vars are set locally before running the script.

---

## 7) Local Development (Optional)

**Prereqs**
- Node.js ≥ 18 (using 22.x now)
- Netlify CLI (was tested with v17.34.3).

**Run**
```bash
netlify dev
```
- Serves static site at http://localhost:8888 (publish `src/`).
- Functions are proxied under `/.netlify/functions/*`.

**Invoke a function directly**
```bash
netlify functions:list
netlify functions:invoke greyMarketLookup --querystring "term=Daytona"
```

**Manual curl (when the local server is running)**
```bash
curl "http://localhost:8888/.netlify/functions/greyMarketLookup?term=Daytona"
```

**Mongo shell check (optional)**
```bash
mongosh "mongodb+srv://patek-cluster.rchgesl.mongodb.net/test" --username <dbUser>
# then in the shell:
const q = {{$or:[
  {{Model: {{ $regex: "Daytona", $options: "i" }} }},
  {{'Model Name': {{ $regex: "Daytona", $options: "i" }} }},
  {{'Nickname or Dial': {{ $regex: "Daytona", $options: "i" }} }}
]}};
db.grey_market_refs.countDocuments(q);
```

---

## 8) Deployment

**One-time**
- Netlify site connected to this repo.
- Environment variables set in Netlify.

**Standard commands**
```bash
git add .
git commit -m "Update UI and functions"
git pull --rebase origin main           # resolve conflicts if any
git push origin main
```

**If files seem outdated on Netlify**
- Check `netlify.toml` is **exactly**:
  ```toml
  [build]
    publish   = "src"
    functions = "functions"

  [functions]
    node_bundler = "esbuild"
  ```
- Confirm `src/index.html`, `src/main.js`, and `functions/*.js` are in the commit that Netlify builds.

---

## 9) Troubleshooting

**UI says “Searching Grey Market…” forever**
- Open browser devtools → **Console** and **Network**.
- Ensure `/.netlify/functions/greyMarketLookup?term=...` returns HTTP 200 + JSON array.
- Check Netlify **Functions logs** to confirm the function runs and returns docs.
- Ensure `renderGreyMarketResults` exists in `src/main.js` and is not stubbed/missing.

**Got results in logs but nothing displays**
- The frontend must call `renderGreyMarketResults(data)` and not error before that.
- Make sure `parseDate` handles `"Date Entered"` formats (`MM/DD/YYYY` or `YYYY-MM-DD`).

**Assets / images missing**
- After restructuring to `src/`, references should be relative to `/assets/...` **from `src/`** (e.g., `src/assets/...`).

**Netlify build fails with config parse error**
- Remove any diff markers (`+`/`-`) in `netlify.toml`. Use the minimal config shown above.

**Multiple GitHub accounts**
- Set repo-local config (doesn’t touch global):
  ```bash
  git config user.name "TexasCouty"
  git config user.email "texascouty@gmail.com"
  git config credential.username "TexasCouty"
  ```
- Prefer HTTPS + PAT or SSH keys per-host.

---

## 10) Security & Git Hygiene

- **Never commit `.env`** or credentials. Use Netlify env vars.
- `.gitignore` should include:
  ```gitignore
  # Env
  .env
  .env.*

  # Local build/cache
  .netlify/
  node_modules/
  backup/

  # Heavy/static media (kept out of git)
  src/assets/
  data/

  # OS/editor
  .DS_Store
  Thumbs.db
  .vscode/
  .idea/
  ```

---

## 11) Backup Script (Windows)

A `backup.bat` lives at project root to snapshot the **important code** (excluding heavy `src\assets`):

```bat
@echo off
setlocal EnableDelayedExpansion

set "SRC=%~dp0"
if "%SRC:~-1%"=="" set "SRC=%SRC:~0,-1%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
  set "MM=%%a" & set "DD=%%b" & set "YYYY=%%c"
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
  set "HH=%%a" & set "Min=%%b"
)
if "%HH:~0,1%"==" " set "HH=0%HH:~1%"
for /f "tokens=2 delims=. " %%s in ("%time%") do set "SS=%%s"
set "TS=%YYYY%-%MM%-%DD%_%HH%-%Min%-%SS%"

set "DEST=%SRC%\backup\%TS%"
mkdir "%DEST%"

echo Backing up to "%DEST%"...

rem Front-end (exclude src\assets)
robocopy "%SRC%\src" "%DEST%\src" /E /XD "%SRC%\src\assets"

rem Functions
robocopy "%SRC%\functions" "%DEST%\functions" /E

rem Config / manifest
robocopy "%SRC%" "%DEST%" netlify.toml package.json package-lock.json .gitignore README.md backup.bat

echo.
echo Done.
pause
```

> The script **creates** `backup\YYYY-MM-DD_hh-mm-ss\` if missing and won’t re-create it on subsequent runs. It copies code and config but **excludes** heavy `src\assets`. You can add `data/` if you want snapshots of CSVs as well.

---

## 12) Quick Start (TL;DR)

1. Set **Netlify env vars**: `MONGO_URI`, `MONGO_DB=test`, `MONGO_COLL=grey_market_refs`, `CLOUDINARY_*`.
2. Ensure `netlify.toml` has `publish="src"` and `functions="functions"`.
3. Push changes:  
   ```bash
   git add .
   git commit -m "update"
   git pull --rebase origin main
   git push origin main
   ```
4. Open site, search with unified field (Model / Model Name / Nickname or Dial). Newest results appear first.
5. Use **Functions logs** on Netlify if results don’t display; check browser console for errors.

---

## 13) Useful Commands

```bash
# Local
netlify dev
netlify functions:list
netlify functions:invoke greyMarketLookup --querystring "term=Daytona"

# Import CSV → Mongo + upload images
node scripts/importNewRows.js

# Git (safe flow)
git add .
git commit -m "Change summary"
git pull --rebase origin main
git push origin main
```

---

## 14) Notes & Conventions

- Date formats vary in the CSV. Both `MM/DD/YYYY` and `YYYY-MM-DD` are supported by the parser.
- Image URLs may be absolute (Cloudinary `https://...`) or relative (`assets/grey_market/...`).
- The **Add New Grey Market Entry** flow was not changed by the unified search work.
- Function logs are your best friend when the UI shows “Searching…” with no results.

---

Happy building!
