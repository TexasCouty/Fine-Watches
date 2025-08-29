#!/usr/bin/env node
/**
 * scripts/loadReferencesToMongo.js
 *
 * Single importer for ALL brands (AP, Patek, etc.)
 * - Reads a JSON array (default: data/references.json)
 * - Upserts into MongoDB collection "references" by Reference
 * - Accepts filters (--only, --brand) and a dry run
 *
 * Env (.env in project root):
 *   MONGO_URI="mongodb+srv://user:pass@cluster/db?retryWrites=true&w=majority"
 *   MONGO_DB="WatchLookup"               (optional)
 *   MONGO_REF_COLL="references"          (optional; default "references")
 *
 * CLI:
 *   node scripts/loadReferencesToMongo.js
 *   node scripts/loadReferencesToMongo.js --file data/references.json --only "5712/1R-001"
 *   node scripts/loadReferencesToMongo.js --brand "Patek Philippe"
 *   node scripts/loadReferencesToMongo.js --dry
 */

'use strict';

require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// ---------- CLI ----------
const argv = process.argv.slice(2);
function getFlag(name, alias) {
  const i = argv.findIndex(a => a === name || (alias && a === alias));
  return i !== -1 ? (argv[i + 1] || '') : '';
}
const FILE_ARG  = getFlag('--file', '-f') || path.join(process.cwd(), 'data', 'references.json');
const ONLY_ARG  = getFlag('--only', '-o');   // "5712/1R-001,5227G-010"
const BRAND_ARG = getFlag('--brand', '-b');  // "Patek Philippe"
const DRY_RUN   = argv.includes('--dry');

// ---------- ENV / Mongo ----------
const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME   = process.env.MONGO_DB || undefined;
const COLL_NAME = process.env.MONGO_REF_COLL || 'references';

if (!MONGO_URI && !DRY_RUN) {
  console.error('MISSING MONGO_URI in .env (or use --dry to preview).');
  process.exit(1);
}

// ---------- Schema (flexible & future-proof) ----------
const RefSchema = new mongoose.Schema({
  Reference:   { type: String, required: true, unique: true, index: true },
  Brand:       { type: String, default: '' },
  Collection:  { type: String, default: '' },
  Description: { type: String, default: '' },
  Details:     { type: String, default: '' },

  // Flexible Specs object (accept any key/value pairs)
  Specs:       { type: mongoose.Schema.Types.Mixed, default: {} },

  Case:        { type: String, default: '' },
  Dial:        { type: String, default: '' },
  Bracelet:    { type: String, default: '' },

  Price:         { type: String, default: '' },
  PriceCurrency: { type: String, default: '' },
  PriceAmount:   { type: Number, default: null },

  ImageFilename: { type: String, default: '' },

  Calibre: {
    Name:            { type: String, default: '' },
    // NEW: Functions as array (not string) to match scraper output
    Functions:       { type: [String], default: [] },
    Mechanism:       { type: String, default: '' },
    TotalDiameter:   { type: String, default: '' },
    Frequency:       { type: String, default: '' },
    NumberOfJewels:  { type: String, default: '' },
    PowerReserve:    { type: String, default: '' },
    NumberOfParts:   { type: String, default: '' },
    Thickness:       { type: String, default: '' },
    Image:           { type: String, default: '' },
    // NEW keys we now capture for Patek:
    WindingRotor:    { type: String, default: '' },
    BalanceSpring:   { type: String, default: '' },
    DistinctiveSign: { type: String, default: '' },
  },

  SourceURL:   { type: String, default: '' },
  Aliases:     { type: [String], default: [] },
  LastUpdated: { type: String, default: '' },

  createdAt:   { type: Date, default: Date.now }
}, { collection: COLL_NAME });

const RefModel = mongoose.model('Reference', RefSchema);

// ---------- Utilities ----------
function readJsonArray(p) {
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    return [];
  }
}

function cleanVal(v) {
  if (v === undefined || v === null) return v;
  if (typeof v === 'string' && v.trim().toUpperCase() === 'N/A') return null;
  return v;
}

function normalizeDoc(doc) {
  // Shallow defaults to keep shape consistent
  const out = {
    Reference: '',
    Brand: '',
    Collection: '',
    Description: '',
    Details: '',
    Specs: {},
    Case: '',
    Dial: '',
    Bracelet: '',
    Price: '',
    PriceCurrency: '',
    PriceAmount: null,
    ImageFilename: '',
    Calibre: {},
    SourceURL: '',
    Aliases: [],
    LastUpdated: new Date().toISOString().slice(0,10),
    ...doc
  };

  // Normalize Calibre
  if (!out.Calibre || typeof out.Calibre !== 'object') out.Calibre = {};
  if (!Array.isArray(out.Calibre.Functions)) {
    // Convert a single string into array if needed
    if (typeof out.Calibre.Functions === 'string' && out.Calibre.Functions.trim() !== '') {
      out.Calibre.Functions = [out.Calibre.Functions.trim()];
    } else {
      out.Calibre.Functions = [];
    }
  }

  // Normalize Specs to object
  if (!out.Specs || typeof out.Specs !== 'object') out.Specs = {};

  // Aliases array
  if (!Array.isArray(out.Aliases)) {
    out.Aliases = out.Aliases ? [String(out.Aliases)] : [];
  }

  // Coerce PriceAmount
  out.PriceAmount = cleanVal(out.PriceAmount);
  if (typeof out.PriceAmount === 'string') {
    const n = Number(out.PriceAmount.replace(/[^0-9.\-]/g, ''));
    out.PriceAmount = Number.isFinite(n) ? n : null;
  }

  // Clean a few string-ish fields
  out.PriceCurrency = cleanVal(out.PriceCurrency);
  if (out.Calibre) {
    for (const k of Object.keys(out.Calibre)) {
      out.Calibre[k] = cleanVal(out.Calibre[k]);
    }
  }

  return out;
}

// ---------- Main ----------
(async () => {
  const all = readJsonArray(FILE_ARG);
  if (!all.length) {
    console.log('No records found in', FILE_ARG);
    process.exit(0);
  }

  // Filters
  let records = all;
  if (ONLY_ARG) {
    const onlySet = new Set(ONLY_ARG.split(',').map(s => s.trim()).filter(Boolean));
    records = records.filter(r => onlySet.has(String(r.Reference || '').trim()));
  }
  if (BRAND_ARG) {
    records = records.filter(r => String(r.Brand || '').trim().toLowerCase() === BRAND_ARG.trim().toLowerCase());
  }

  if (!records.length) {
    console.log('Nothing to import after filters.');
    process.exit(0);
  }

  console.log(`Preparing to upsert ${records.length} record(s) into ${DB_NAME || '(default DB)'} . ${COLL_NAME}`);
  if (DRY_RUN) {
    const first = normalizeDoc(records[0]);
    console.log('[DRY] First normalized doc:\n', JSON.stringify(first, null, 2));
    process.exit(0);
  }

  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  console.log('Connected');

  // Make sure unique index exists
  await RefModel.init();

  // Bulk upsert
  const ops = records.map((raw) => {
    const doc = normalizeDoc(raw);
    const ref = String(doc.Reference || '').trim();
    if (!ref) {
      return null;
    }
    return {
      updateOne: {
        filter: { Reference: ref },
        update: { $set: doc, $setOnInsert: { createdAt: new Date() } },
        upsert: true
      }
    };
  }).filter(Boolean);

  const res = await RefModel.bulkWrite(ops, { ordered: false });
  console.log(`Upserted: ${res.upsertedCount || 0}, Modified: ${res.modifiedCount || 0}`);

  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
