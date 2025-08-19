// scripts/loadReferencesToMongo.js
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const FILE = path.join(process.cwd(), 'data', 'references.json');

const RefSchema = new mongoose.Schema({
  Reference: { type: String, required: true, unique: true, index: true },
  Brand: String,
  Collection: String,
  Description: String,
  Details: String,
  Specs: {
    case_diameter_mm: Number,
    water_resistance_m: Number
  },
  Case: String,
  Dial: String,
  Bracelet: String,
  Price: String,
  PriceCurrency: String,
  PriceAmount: Number,
  ImageFilename: String,
  Calibre: {
    Name: String,
    Functions: String,
    Mechanism: String,
    TotalDiameter: String,
    Frequency: String,
    NumberOfJewels: String,
    PowerReserve: String,
    NumberOfParts: String,
    Thickness: String,
    Image: String
  },
  SourceURL: String,
  Aliases: [String],
  LastUpdated: String
}, { collection: 'references' });

const RefModel = mongoose.model('Reference', RefSchema);

function clean(v) {
  if (v === undefined || v === null) return v;
  if (typeof v === 'string' && v.trim().toUpperCase() === 'N/A') return null;
  return v;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in .env');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || undefined });
  console.log(`Connected. Upserting ${raw.length} references…`);

  const ops = raw.map((doc) => {
    // sanitize a few fields
    doc.PriceAmount   = clean(doc.PriceAmount);
    doc.PriceCurrency = clean(doc.PriceCurrency);
    if (doc.Calibre && typeof doc.Calibre === 'object') {
      for (const k of Object.keys(doc.Calibre)) doc.Calibre[k] = clean(doc.Calibre[k]);
    }
    return {
      updateOne: {
        filter: { Reference: doc.Reference },
        update: { $set: doc },
        upsert: true
      }
    };
  });

  // ensure unique index
  await RefModel.init();

  const res = await RefModel.bulkWrite(ops, { ordered: false });
  console.log(`Upserted: ${res.upsertedCount || 0}, Modified: ${res.modifiedCount || 0}`);
  await mongoose.disconnect();
  console.log('Done.');
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
