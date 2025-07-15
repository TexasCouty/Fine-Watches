onst { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('⚙️ Grey Market Lookup Function STARTED');

  if (event.httpMethod !== 'GET') {
    console.warn(`❌ Invalid HTTP method: ${event.httpMethod}`);
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed, use GET' }) };
  }

  try {
    const refRaw = event.queryStringParameters?.reference || '';
    const ref = refRaw.trim();

    console.log(`🔍 Received query parameter: "${ref}"`);

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Using cached MongoDB client');
    }

    const db = cachedClient.db('test');
    const collection = db.collection('grey_market_refs');

    const query = ref ? { Model: { $regex: ref, $options: 'i' } } : {};
    console.log('📡 Running query:', JSON.stringify(query));

    const results = await collection.find(query).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (err) {
    console.error('💥 ERROR in greyMarketLookup:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};




