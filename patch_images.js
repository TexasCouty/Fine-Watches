require('dotenv').config(); // ✅ Loads .env vars automatically
const { MongoClient } = require('mongodb');
const fs = require('fs');

// ✅ Uses your .env MONGO_URI
const uri = process.env.MONGO_URI;

async function main() {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected.');

    const db = client.db('test'); // Make sure this matches your live DB name!
    const collection = db.collection('watch_refs');

    console.log(`📂 Using DB: test`);
    console.log(`📁 Using Collection: watch_refs`);

    // ✅ Load your patch JSON
    const data = JSON.parse(fs.readFileSync('./patch_images.json', 'utf8'));

    let patched = 0;

    for (const doc of data) {
      if (doc.images && doc.images.length > 0) {
        const result = await collection.updateOne(
          { reference: doc.reference },
          { $set: { images: doc.images } },
          { upsert: false }
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

