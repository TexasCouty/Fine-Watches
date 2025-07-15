// importNewRows.js

const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;              // your Mongo URI
const CSV_FILE = 'grey_market_refs.csv';              // your CSV
const DB_NAME = 'test';                               // your DB name
const COLLECTION_NAME = 'grey_market_refs';           // your collection

// Folders where you might drop images
const IMAGE_SRC_DIRS = [
  path.join(__dirname, 'assets/Grey Market Assets'),
  path.join(__dirname, 'assets/grey_market')
];
// Where we want them deployed
const IMAGE_TARGET_DIR = path.join(__dirname, 'assets/grey_market');

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

          // look for image in any source folder, copy it if found
          const imageFile = `${uniqueID}-001.jpg`;
          let foundImage = false;
          for (const srcDir of IMAGE_SRC_DIRS) {
            const srcPath = path.join(srcDir, imageFile);
            if (fs.existsSync(srcPath)) {
              const tgtPath = path.join(IMAGE_TARGET_DIR, imageFile);
              if (!fs.existsSync(tgtPath)) {
                fs.copyFileSync(srcPath, tgtPath);
                console.log(`Copied ${imageFile} → assets/grey_market/`);
              }
              record.ImageFilename = imageFile;
              foundImage = true;
              break;
            }
          }

          const exists = await collection.findOne({ 'Unique ID': uniqueID });
          if (exists) {
            // if we just found an image but the DB doc lacked it, update
            if (foundImage && !exists.ImageFilename) {
              await collection.updateOne(
                { 'Unique ID': uniqueID },
                { $set: { ImageFilename: record.ImageFilename } }
              );
              console.log(`Updated ImageFilename for Unique ID: ${uniqueID}`);
            } else {
              console.log(`Skipping existing Unique ID: ${uniqueID}`);
            }
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

