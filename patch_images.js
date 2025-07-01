const { MongoClient } = require('mongodb');
const fs = require('fs');

// ✅ Your Atlas connection string
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

    // ✅ Load your updated JSON
    const data = JSON.parse(fs.readFileSync('./master_references_skydweller_updated.json', 'utf8'));

    let patched = 0;

    for (const doc of data) {
      if (doc.images && doc.images.length > 0) {
        const result = await collection.updateOne(
          { reference: doc.reference },
          { $set: { images: doc.images } },
          { upsert: false } // Only update existing docs
        );
        patched++;
        console.log(`✅ Patched ${doc.reference} with images: ${JSON.stringify(doc.images)}`);
      }
    }

    console.log(`🏆 Done! Patched ${patched} references with images.`);

  } catch (err) {
    console.error('💥 ERROR:', err);
  } finally {
    await client.close();
    console.log('🔒 Connection closed.');
  }
}

main();
