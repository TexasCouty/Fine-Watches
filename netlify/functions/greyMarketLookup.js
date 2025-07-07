const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('⚙️ Grey Market Lookup Function STARTED');

  try {
    if (event.httpMethod !== 'GET') {
      console.log('❌ Invalid HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
      };
    }

    const refRaw = event.queryStringParameters?.reference || '';
    const ref = refRaw.trim();
    console.log(`🔍 Received query parameter (raw): "${refRaw}"`);
    console.log(`🔍 Trimmed query parameter: "${ref}"`);

    if (!ref) {
      console.log('❌ Empty reference parameter');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Reference parameter is required.' }),
      };
    }

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Using cached MongoDB client');
    }

    const db = cachedClient.db('test'); // Adjust to your actual DB name if different
    const collection = db.collection('grey_market_refs'); // Corrected collection name

    const totalCount = await collection.countDocuments();
    console.log(`🗃️ Total documents in grey_market_refs collection: ${totalCount}`);

    // Try exact match first (debug step)
    let results = await collection.find({ Model: ref }).toArray();
    console.log(`🔎 Exact match query returned ${results.length} result(s)`);

    // If no results, try regex partial match
    if (results.length === 0) {
      console.log(`🔎 No exact match results, trying regex partial match...`);
      results = await collection.find({
        Model: { $regex: ref, $options: 'i' }
      }).toArray();
      console.log(`🔎 Regex partial match query returned ${results.length} result(s)`);
    }

    console.log('✅ Returning results');
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

