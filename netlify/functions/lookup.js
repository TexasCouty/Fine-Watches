const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI; // Ensure this is set correctly in Netlify environment variables
let cachedClient = null;

exports.handler = async function (event) {
  console.log('⚙️ Lookup Function STARTED');

  try {
    if (event.httpMethod !== 'GET') {
      console.log('❌ Invalid HTTP method:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
      };
    }

    const ref = event.queryStringParameters?.ref;
    console.log(`🔍 Received query ref: ${ref}`);

    if (!ref || typeof ref !== 'string' || ref.trim() === '') {
      console.log('❌ No valid reference provided.');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No valid reference provided.' }),
      };
    }

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Using cached MongoDB client.');
    }

    // Replace 'test' with your actual database name if different
    const db = cachedClient.db('test');
    const collection = db.collection('watch_refs');

    console.log(`📡 Running regex query for reference matching: "${ref}"`);

    // Perform case-insensitive partial match on 'reference' field
    const results = await collection.find({
      reference: { $regex: ref, $options: 'i' },
    }).toArray();

    console.log(`✅ Query returned ${results.length} result(s)`);
    if (results.length > 0) {
      console.log(`📦 Sample result: ${JSON.stringify(results[0], null, 2)}`);
    }

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

