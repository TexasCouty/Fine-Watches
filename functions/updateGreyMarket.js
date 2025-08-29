const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

const { read, NAME } = require('./_lib/session');

exports.handler = async (event) => {
  console.log('✏️ Update Grey Market Function STARTED');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    // FIX: use uniqueId instead of Model!
    const { uniqueId, fields } = body;
    console.log('Fields to update:', fields);
    if (!uniqueId || !fields) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing uniqueId or fields' }) };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // adjust DB name if needed
    const collection = db.collection('grey_market_refs');

    // FIX: Query by "Unique ID" field
    const result = await collection.updateOne({ "Unique ID": uniqueId }, { $set: fields });
    console.log('✅ Update result:', result);

    if (result.matchedCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Unique ID not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Updated successfully' }) };
  } catch (err) {
    console.error('💥 ERROR during update:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
