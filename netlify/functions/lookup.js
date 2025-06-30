const { MongoClient } = require('mongodb');

// Use env var for safety:
const uri = process.env.MONGO_URI;

// Cache the client between calls
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

    const db = cachedClient.db('watchlookup');
    const collection = db.collection('watch_refs');

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

    console.log(`📦 Sending results: ${JSON.stringify(results)}`);
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

