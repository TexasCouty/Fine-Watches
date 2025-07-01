const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event) {
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
      console.log('♻️ Using cached MongoDB client.');
    }

    const db = cachedClient.db('watchlookup');
    const collection = db.collection('watch_refs');

    console.log(`📡 Running regex query for: ${ref}`);

    const results = await collection.find({
      reference: { $regex: ref, $options: 'i' },
    }).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);
    console.log(`📦 Results JSON: ${JSON.stringify(results, null, 2)}`);

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

