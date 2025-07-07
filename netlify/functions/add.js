const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event) {
  console.log('➕ Add Function STARTED');

  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid HTTP method:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('🗂️ Raw event body:', event.body);
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    if (!body.reference) {
      console.log('❌ Missing reference');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing reference' }),
      };
    }

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Reusing cached MongoDB client');
    }

    const db = cachedClient.db('test'); // adjust if needed
    const collection = db.collection('watch_refs');

    const result = await collection.insertOne(body);

    console.log('✅ Inserted new doc:', result.insertedId);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Added successfully', id: result.insertedId }),
    };

  } catch (err) {
    console.error('💥 ERROR during insert:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
