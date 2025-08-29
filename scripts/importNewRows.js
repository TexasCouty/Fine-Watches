'use strict';

/**
 * scripts/importNewRows.js
 *
 * Bulk-import Grey Market CSV rows into MongoDB and attach images.
 *
 * Features:
 *  - Loads .env from project root reliably.
 *  - Searches images under src/assets/grey_market (and legacy fallbacks).
 *  - --force / -f will DESTROY the prior Cloudinary asset, re-upload, and invalidate CDN.
 *  - --only / -o 10216,10301 limits to selected Unique IDs.
 *  - Clear, structured logs.
 */

const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

// ----------------------
// Env + constants
// ----------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

function maskMongoUri(uri) {
  if (!uri) return '<undefined>';
  try { return uri.replace(/\/\/([^@]+)@/, '//***:***@'); }
  catch { return '<unparseable>'; }
}

const MONGO_URI     = process.env.MONGO_URI;
const DB_NAME       = process.env.MONGO_DB   || 'test';
const COLL_NAME     = process.env.MONGO_COLL || 'grey_market_refs';
const CSV_FILE_PATH = path.join(PROJECT_ROOT, 'data', 'grey_market_refs.csv');

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'grey_market';
const SKIP_CLOUDINARY   = process.env.SKIP_CLOUDINARY === '1';

// CLI flags
const ARG_FORCE = process.argv.includes('--force') || process.argv.includes('-f');
const onlyIdx   = process.argv.findIndex(a => a === '--only' || a === '-o');
let ONLY_UIDS   = null;
if (onlyIdx !== -1 && process.argv[onlyIdx + 1]) {
  ONLY_UIDS = new Set(
    process.argv[onlyIdx + 1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
}

const FORCE_REUPLOAD = ARG_FORCE || process.env.FORCE_REUPLOAD === '1';

// Prefer src/assets, keep legacy fallbacks for compatibility
const IMAGE_SRC_DIRS = [
  path.join(PROJECT_ROOT, 'src', 'assets', 'grey_market'),
  path.join(PROJECT_ROOT, 'src', 'assets', 'Grey Market Assets'),
  path.join(PROJECT_ROOT, 'assets', 'grey_market'),
  path.join(PROJECT_ROOT, 'assets', 'Grey Market Assets'),
];
const IMAGE_TARGET_DIR = path.join(PROJECT_ROOT, 'src', 'assets', 'grey_market'); // local fallback copy

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------------
// Helpers
// ----------------------
function logHeader(extra) {
  const now = new Date().toISOString();
  console.log('=== importNewRows START ===');
  console.log('time=', now);
  console.log('mongo.uri=', maskMongoUri(MONGO_URI));
  console.log('mongo.db=', DB_NAME, 'coll=', COLL_NAME);
  console.log('csv=', CSV_FILE_PATH);
  console.log('img.srcDirs=', IMAGE_SRC_DIRS);
  console.log('cloud.folder=', CLOUDINARY_FOLDER, 'force_reupload=', FORCE_REUPLOAD, 'skip_cloudinary=', SKIP_CLOUDINARY);
  if (ONLY_UIDS) console.log('only_uids=', Array.from(ONLY_UIDS).join(','));
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(k => console.log(k + '=', extra[k]));
  }
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function findLocalImage(uniqueID) {
  const candidates = [
    uniqueID + '-001.jpg', uniqueID + '-001.jpeg', uniqueID + '-001.png',
    uniqueID + '.jpg',     uniqueID + '.jpeg',     uniqueID + '.png',
  ];
  for (let d = 0; d < IMAGE_SRC_DIRS.length; d++) {
    const dir = IMAGE_SRC_DIRS[d];
    for (let i = 0; i < candidates.length; i++) {
      const file = candidates[i];
      const full = path.join(dir, file);
      if (fs.existsSync(full)) return { full, dir, file };
    }
  }
  return null;
}

async function uploadToCloudinary(localPath, publicId) {
  if (SKIP_CLOUDINARY) return null;
  try {
    const publicPath = CLOUDINARY_FOLDER + '/' + publicId;

    if (FORCE_REUPLOAD) {
      try {
        await cloudinary.uploader.destroy(publicPath, { invalidate: true });
        console.log('  - Cloudinary: destroyed existing asset (if any)');
      } catch (e) {
        console.log('  - Cloudinary: destroy skipped/failed:', e && e.message ? e.message : e);
      }
    } else {
      try {
        const existing = await cloudinary.api.resource(publicPath);
        if (existing && existing.secure_url) {
          console.log('  - Cloudinary: already exists → ' + existing.secure_url);
          return existing.secure_url;
        }
      } catch (e) {
        // Not found → proceed to upload
      }
    }

    const res = await cloudinary.uploader.upload(localPath, {
      folder: CLOUDINARY_FOLDER,
      public_id: publicId,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
      invalidate: true,
    });
    console.log('  - Cloudinary: uploaded v' + res.version + ' → ' + res.secure_url);
    return res.secure_url;
  } catch (err) {
    console.error('  ! Cloudinary upload error:', err && err.message ? err.message : err);
    return null;
  }
}

// ----------------------
// Main
// ----------------------
async function importNewRows() {
  logHeader();

  if (!MONGO_URI) {
    console.error('Missing MONGO_URI. Check your .env at the project root.');
    process.exit(1);
  }
  ensureDir(IMAGE_TARGET_DIR);

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const coll = db.collection(COLL_NAME);

  const records = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', row => records.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  console.log('Loaded ' + records.length + ' CSV rows.');

  let processed = 0;

  for (let r = 0; r < records.length; r++) {
    const record = records[r];
    const uniqueID = String(record['Unique ID'] || '').trim();
    if (!uniqueID) { console.log('Skipping row without Unique ID'); continue; }
    if (ONLY_UIDS && !ONLY_UIDS.has(uniqueID)) continue;

    console.log('-- Processing Unique ID ' + uniqueID + ' --');

    // Prefer local image → Cloudinary
    let usedUrl = '';
    const local = findLocalImage(uniqueID);
    if (local) {
      console.log('  - Found local image: ' + local.full);
      const publicId = local.file.replace(/\.[^/.]+$/, ''); // drop extension
      const cloudUrl = await uploadToCloudinary(local.full, publicId);

      if (cloudUrl) {
        usedUrl = cloudUrl; // absolute URL
      } else {
        // Fallback: copy into src/assets so relative path works locally
        const tgt = path.join(IMAGE_TARGET_DIR, local.file);
        if (!fs.existsSync(tgt)) {
          fs.copyFileSync(local.full, tgt);
          console.log('  - Copied image to project assets: ' + tgt);
        }
        usedUrl = 'assets/grey_market/' + local.file; // relative path
      }
    } else {
      console.log('  - No local image found in any src dir. Leaving ImageFilename as-is if present.');
    }

    if (usedUrl) record.ImageFilename = usedUrl;

    // Upsert by Unique ID
    await coll.updateOne(
      { 'Unique ID': uniqueID },
      { $set: record },
      { upsert: true }
    );

    console.log('  ✓ Upserted ' + uniqueID + (usedUrl ? ' (ImageFilename updated)' : ''));
    processed++;
  }

  console.log('Done. Processed ' + processed + ' record(s).');
  await client.close();
}

importNewRows().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
