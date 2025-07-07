const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function(event) {
  console.log('🗑️ Delete Function STARTED');

  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid HTTP method:', event.httpMethod);
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    if (!body.reference) {
      console.log('❌ Missing reference');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing reference' }) };
    }

    if (!cachedClient) {
      console.log('🧩 Connecting to MongoDB...');
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    } else {
      console.log('♻️ Reusing cached MongoDB client');
    }

    const db = cachedClient.db('test'); // adjust DB name
    const collection = db.collection('watch_refs');

    const result = await collection.deleteOne({ reference: body.reference });
    console.log('✅ Delete result:', result);

    if (result.deletedCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Reference not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Deleted successfully' }) };
  } catch (err) {
    console.error('💥 ERROR during delete:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};

