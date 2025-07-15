const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI; // Use your existing environment variable
const CSV_FILE = 'grey_market_refs.csv';  // Keep your actual CSV filename
const DB_NAME = 'test';       // Your DB name
const COLLECTION_NAME = 'grey_market_refs'; // Your collection name

async function importNewRows() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const records = [];

    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        records.push(row);
      })
      .on('end', async () => {
        console.log(`Loaded ${records.length} records from CSV`);

        for (const record of records) {
          if (!record['Unique ID']) {
            console.log('Skipping record without Unique ID:', record);
            continue;
          }
          const exists = await collection.findOne({ 'Unique ID': record['Unique ID'] });
          if (exists) {
            console.log(`Skipping existing Unique ID: ${record['Unique ID']}`);
          } else {
            await collection.insertOne(record);
            console.log(`Inserted new Unique ID: ${record['Unique ID']}`);
          }
        }

        await client.close();
        console.log('Import complete, connection closed');
      });
  } catch (error) {
    console.error('Error during import:', error);
    await client.close();
  }
}

importNewRows();
