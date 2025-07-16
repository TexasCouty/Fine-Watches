// importNewRows.js

require('dotenv').config(); // Loads environment variables from .env

const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { MongoClient } = require('mongodb');
const cloudinary = require('cloudinary').v2;

// ---- Cloudinary config ----
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ---- MongoDB & file config ----
const MONGO_URI = process.env.MONGO_URI;
const CSV_FILE = 'grey_market_refs.csv';
const DB_NAME = 'test';
const COLLECTION_NAME = 'grey_market_refs';

const IMAGE_SRC_DIRS = [
  path.join(__dirname, 'assets/Grey Market Assets'),
  path.join(__dirname, 'assets/grey_market')
];
const IMAGE_TARGET_DIR = path.join(__dirname, 'assets/grey_market');

async function uploadToCloudinary(localPath, publicId) {
  try {
    // Check if this file is already in Cloudinary
    const resource = await cloudinary.api.resource(`grey_market/${publicId}`).catch(() => null);
    if (resource && resource.secure_url) {
      console.log(`Cloudinary: File for ${publicId} already exists, skipping upload.`);
      return resource.secure_url;
    }

    // Not found, upload!
    const result = await cloudinary.uploader.upload(localPath, {
      folder: 'grey_market',
      public_id: publicId,
      use_filename: true,
      unique_filename: false,
      overwrite: false // Don't create versions, just fail if exists
    });
    return result.secure_url;
  } catch (err) {
    if (err.http_code === 409) {
      // File already exists, return its URL (409 = conflict)
      try {
        const existing = await cloudinary.api.resource(`grey_market/${publicId}`);
        return existing.secure_url;
      } catch (e) {
        console.error('Cloudinary lookup failed:', e.message);
        return null;
      }
    } else {
      console.error(`Cloudinary upload failed for ${localPath}:`, err.message);
      return null;
    }
  }
}

async function importNewRows() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // ensure target folder exists
    if (!fs.existsSync(IMAGE_TARGET_DIR)) {
      fs.mkdirSync(IMAGE_TARGET_DIR, { recursive: true });
      console.log(`Created ${IMAGE_TARGET_DIR}`);
    }

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const records = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', row => records.push(row))
      .on('end', async () => {
        console.log(`Loaded ${records.length} records from CSV`);

        for (const record of records) {
          const uniqueID = record['Unique ID'];
          if (!uniqueID) {
            console.log('Skipping record without Unique ID:', record);
            continue;
          }

          // try to find a local image
          const imageFile = `${uniqueID}-001.jpg`;
          let foundImage = false;
          let cloudinaryUrl = '';
          for (const srcDir of IMAGE_SRC_DIRS) {
            const srcPath = path.join(srcDir, imageFile);
            if (fs.existsSync(srcPath)) {
              // Try Cloudinary upload or reuse
              cloudinaryUrl = await uploadToCloudinary(srcPath, imageFile.replace(/\.[^/.]+$/, ''));
              if (cloudinaryUrl) {
                record.ImageFilename = cloudinaryUrl;
                foundImage = true;
                console.log(`Cloudinary: Using URL for ${imageFile}`);
              } else {
                // fallback: just use local
                const tgtPath = path.join(IMAGE_TARGET_DIR, imageFile);
                if (!fs.existsSync(tgtPath)) {
                  fs.copyFileSync(srcPath, tgtPath);
                  console.log(`Copied ${imageFile} → assets/grey_market/`);
                }
                record.ImageFilename = imageFile;
                foundImage = true;
              }
              break; // only use first found image
            }
          }

          // Find existing record by Unique ID
        const exists = await collection.findOne({ 'Unique ID': uniqueID });
		if (exists) {
 	 	// Always update all fields for existing record
 	 	await collection.updateOne(
    		{ 'Unique ID': uniqueID },
   		 { $set: record }
  		);
  	console.log(`Updated all fields for Unique ID: ${uniqueID}`);
	} else {
  		// brand new record (with image if found)
  		await collection.insertOne(record);
  		console.log(`Inserted new Unique ID: ${uniqueID}`);
}
        }

        await client.close();
        console.log('Import complete, connection closed');
      });
  } catch (err) {
    console.error('Error during import:', err);
    await client.close();
  }
}

importNewRows();

