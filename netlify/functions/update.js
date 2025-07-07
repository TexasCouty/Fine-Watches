const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function(event) {
  console.log('✏️ Update Function STARTED');

  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid HTTP method:', event.httpMethod);
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    const { reference, fields } = body;
    if (!reference || !fields) {
      console.log('❌ Missing reference or fields');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing reference or fields' }) };
    }

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Using cached MongoDB client');
    }

    const db = cachedClient.db('test');
    const collection = db.collection('watch_refs');

    const result = await collection.updateOne(
      { reference },
      { $set: fields }
    );

    console.log('✅ Update result:', result);

    if (result.matchedCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Reference not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Updated successfully' }) };
  } catch (err) {
    console.error('💥 ERROR during update:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};

