// scripts/importNewRows.js

const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

// ---- Cloudinary config ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---- MongoDB & file config ----
const MONGO_URI        = process.env.MONGO_URI;
const DB_NAME          = process.env.MONGO_DB   || 'test';
const COLLECTION_NAME  = process.env.MONGO_COLL || 'grey_market_refs';
const CSV_FILE_PATH    = path.join(__dirname, '..', 'data', 'grey_market_refs.csv');

// look for originals in either of these folders:
const IMAGE_SRC_DIRS = [
  path.join(__dirname, '..', 'assets', 'Grey Market Assets'),
  path.join(__dirname, '..', 'assets', 'grey_market'),
];
// copy‐to (local fallback) uses this target:
const IMAGE_TARGET_DIR = path.join(__dirname, '..', 'assets', 'grey_market');

async function uploadToCloudinary(localPath, publicId) {
  try {
    // see if it’s already there
    const existing = await cloudinary.api
      .resource(`grey_market/${publicId}`)
      .catch(() => null);
    if (existing && existing.secure_url) {
      console.log(`Cloudinary: skipped upload for ${publicId}, already exists.`);
      return existing.secure_url;
    }
    // otherwise upload
    const res = await cloudinary.uploader.upload(localPath, {
      folder: 'grey_market',
      public_id: publicId,
      use_filename: true,
      unique_filename: false,
      overwrite: false,
    });
    return res.secure_url;
  } catch (err) {
    if (err.http_code === 409) {
      // conflict → already exists
      const dup = await cloudinary.api.resource(`grey_market/${publicId}`);
      return dup.secure_url;
    }
    console.error(`Cloudinary upload failed for ${publicId}:`, err.message);
    return null;
  }
}

async function importNewRows() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // ensure local target folder exists
    if (!fs.existsSync(IMAGE_TARGET_DIR)) {
      fs.mkdirSync(IMAGE_TARGET_DIR, { recursive: true });
      console.log(`Created folder ${IMAGE_TARGET_DIR}`);
    }

    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    const records = [];
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csv())
      .on('data', row => records.push(row))
      .on('end', async () => {
        console.log(`Loaded ${records.length} records from CSV`);

        for (const record of records) {
          const uniqueID = record['Unique ID'];
          if (!uniqueID) {
            console.log('Skipping row without Unique ID:', record);
            continue;
          }

          // look for a local image file
          const imageFile = `${uniqueID}-001.jpg`;
          let usedUrl = '';

          for (const srcDir of IMAGE_SRC_DIRS) {
            const srcPath = path.join(srcDir, imageFile);
            if (fs.existsSync(srcPath)) {
              // try Cloudinary
              const pubId = imageFile.replace(/\.[^/.]+$/, '');
              const url = await uploadToCloudinary(srcPath, pubId);
              if (url) {
                usedUrl = url;
                console.log(`Cloudinary: found/used ${imageFile}`);
              } else {
                // fallback: copy local
                const tgtPath = path.join(IMAGE_TARGET_DIR, imageFile);
                if (!fs.existsSync(tgtPath)) {
                  fs.copyFileSync(srcPath, tgtPath);
                  console.log(`Copied ${imageFile} → assets/grey_market/`);
                }
                usedUrl = imageFile;
              }
              break;
            }
          }

          if (usedUrl) record.ImageFilename = usedUrl;

          // upsert by Unique ID
          await collection.updateOne(
            { 'Unique ID': uniqueID },
            { $set: record },
            { upsert: true }
          );
          console.log(`Upserted Unique ID: ${uniqueID}`);
        }

        console.log('Import complete');
        await client.close();
      });
  } catch (err) {
    console.error('Import error:', err);
    await client.close();
  }
}

importNewRows();
