const { MongoClient } = require('mongodb');

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

    // NEW: Also support nickname_or_dial as a query param
    const nicknameOrDialRaw = event.queryStringParameters?.nickname_or_dial || '';
    const nicknameOrDial = nicknameOrDialRaw.trim();

    console.log(`🔍 Received query parameter: reference="${ref}", nickname_or_dial="${nicknameOrDial}"`);

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

    // Construct query:
    let query = {};
    if (ref) {
      query = {
        $or: [
          { Model: { $regex: ref, $options: 'i' } },
          { "Model Name": { $regex: ref, $options: 'i' } }
        ]
      };
    } else if (nicknameOrDial) {
      query = {
        "Nickname or Dial": { $regex: nicknameOrDial, $options: 'i' }
      };
    }
    console.log('📡 Running query:', JSON.stringify(query));

    // SORT BY Date Entered DESCENDING (latest first)
    const results = await collection
      .find(query)
      .sort({ "Date Entered": -1 })  // <-- Sort here!
      .toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (err) {
    console.error('💥 ERROR in greyMarketLookup:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
