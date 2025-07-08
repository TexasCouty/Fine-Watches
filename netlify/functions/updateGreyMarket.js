const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('✏️ Update Grey Market Function STARTED');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('✅ Parsed body:', body);

    const { Model, fields } = body;
    console.log('Fields to update:', fields);
    if (!Model || !fields) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing Model or fields' }) };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // adjust DB name
    const collection = db.collection('grey_market_refs');

    const result = await collection.updateOne({ Model }, { $set: fields });
    console.log('✅ Update result:', result);

    if (result.matchedCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Model not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Updated successfully' }) };
  } catch (err) {
    console.error('💥 ERROR during update:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
