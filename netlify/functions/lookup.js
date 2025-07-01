const { MongoClient } = require('mongodb');

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
    console.log(`📁 Using DB: ${dbName}`);
    const db = cachedClient.db(dbName);

    const collectionName = 'watch_refs';
    console.log(`📂 Using Collection: ${collectionName}`);
    const collection = db.collection(collectionName);

    // Log the first doc to verify connection is good
    const firstDoc = await collection.findOne({});
    console.log('🔎 First doc in collection:', JSON.stringify(firstDoc));

    console.log(`📡 Running regex query for: ${ref}`);
    const results = await collection.find({
      reference: { $regex: ref, $options: 'i' },
    }).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);

    if (results.length === 0) {
      console.log(`🚫 No match found for: ${ref}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Reference "${ref}" not found.` }),
      };
    }

    // ✅ ✅ ✅ Added log — see exactly what your API returns
    console.log('🟢 Final results JSON:', JSON.stringify(results, null, 2));

    console.log(`📦 Sending results back to client`);
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

