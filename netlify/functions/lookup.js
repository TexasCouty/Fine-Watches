const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event, context) {
  console.log('⚙️ Lookup Function STARTED');

  const ref = event.queryStringParameters.ref;
  console.log(`🔍 Received query ref: ${ref}`);

  if (!ref) {
    console.log('❌ No reference provided.');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No reference provided.' }),
    };
  }

  try {
    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Reusing cached MongoDB client.');
    }

    const dbName = 'watchlookup';
    const db = cachedClient.db(dbName);
    const collection = db.collection('watch_refs');

    const results = await collection.find({
      reference: { $regex: ref, $options: 'i' },
    }).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);

    if (results.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Reference "${ref}" not found.` }),
      };
    }

    // ✅ New: dynamically attach matching image filenames with logging
    const assetsPath = path.resolve(__dirname, '../../assets');
    console.log(`📂 Assets path resolved to: ${assetsPath}`);

    const allFiles = fs.readdirSync(assetsPath);
    console.log(`🗂️ Total files in assets: ${allFiles.length}`);

    results.forEach(doc => {
      doc.images = allFiles.filter(filename => filename.startsWith(doc.reference));
      console.log(`🔗 ${doc.reference} matched images: ${JSON.stringify(doc.images)}`);
    });

    console.log('🟢 Final results JSON with images:', JSON.stringify(results, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };

  } catch (err) {
    console.error('💥 ERROR during MongoDB lookup:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

