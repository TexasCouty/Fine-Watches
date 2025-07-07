const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('⚙️ Grey Market Lookup Function STARTED');

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const refRaw = event.queryStringParameters?.reference || '';
    const ref = refRaw.trim();
    console.log(`🔍 Received query parameter: "${ref}"`);

    if (!ref) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Reference parameter is required' }) };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // adjust DB name
    const collection = db.collection('grey_market_refs');

    const results = await collection.find({
      Model: { $regex: ref, $options: 'i' }
    }).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);

    return { statusCode: 200, body: JSON.stringify(results) };
  } catch (err) {
    console.error('💥 ERROR in greyMarketLookup:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};


