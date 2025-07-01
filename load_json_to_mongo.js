const { MongoClient } = require('mongodb');
const fs = require('fs');

// ✅ Use your working Mongo URI — safe to paste for local dev:
const uri = 'mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster';

async function main() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected.');

    const dbName = 'watchlookup';
    const collectionName = 'watch_refs';

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    console.log(`📂 Using DB: ${dbName}`);
    console.log(`📁 Using Collection: ${collectionName}`);

    // ✅ Read your JSON file
    const data = JSON.parse(fs.readFileSync('./master_references_skydweller_dials_bracelet_corrected.json', 'utf8'));
    console.log(`📦 Loaded ${data.length} records from JSON.`);

    // ✅ Use upsert to prevent duplicates
    let count = 0;
    for (const ref of data) {
      const result = await collection.updateOne(
        { reference: ref.reference },  // match by reference
        { $set: ref },                 // update with new data
        { upsert: true }               // insert if not found
      );
      count++;
    }

    console.log(`✅ Finished. Upserted ${count} references.`);

  } catch (err) {
    console.error('💥 Error:', err);
  } finally {
    await client.close();
    console.log('🔒 Connection closed.');
  }
}

main();

