// load_json_to_mongo.js
const { MongoClient } = require('mongodb');
const fs = require('fs');

async function main() {
  const uri = "mongodb+srv://texascouty21:<Crystal7568#>@patek-cluster.rchgesl.mongodb.net/watchlookup?retryWrites=true&w=majority&appName=patek-cluster";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(); // uses DB name in URI → watchlookup
    const collection = db.collection('watch_refs');

    // Load JSON
    const data = JSON.parse(fs.readFileSync('./master_references_skydweller_dials_bracelet_corrected.json', 'utf8'));

    // Insert
    const result = await collection.insertMany(data);
    console.log(`✅ Inserted ${result.insertedCount} documents`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

main();
