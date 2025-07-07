const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function(event) {
  console.log('➕ Add Function STARTED');

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

    // Prevent duplicate reference insertions by checking first
    const exists = await collection.findOne({ reference: body.reference });
    if (exists) {
      console.log('⚠️ Reference already exists:', body.reference);
      return { statusCode: 409, body: JSON.stringify({ error: 'Reference already exists' }) };
    }

    const result = await collection.insertOne(body);
    console.log('✅ Inserted new doc:', result.insertedId);

    return { statusCode: 200, body: JSON.stringify({ message: 'Added successfully', id: result.insertedId }) };
  } catch (err) {
    console.error('💥 ERROR during insert:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
