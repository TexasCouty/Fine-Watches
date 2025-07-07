const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('➕ Add Grey Market Function STARTED');

  if (event.httpMethod !== 'POST') {
    console.log('❌ Invalid HTTP method:', event.httpMethod);
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    if (!body.Model) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing Model field' }) };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // adjust DB name
    const collection = db.collection('grey_market_refs');

    const exists = await collection.findOne({ Model: body.Model });
    if (exists) {
      console.log('⚠️ Model already exists:', body.Model);
      return { statusCode: 409, body: JSON.stringify({ error: 'Model already exists' }) };
    }

    const result = await collection.insertOne(body);
    console.log('✅ Inserted new doc:', result.insertedId);

    return { statusCode: 200, body: JSON.stringify({ message: 'Added successfully', id: result.insertedId }) };
  } catch (err) {
    console.error('💥 ERROR during add:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
