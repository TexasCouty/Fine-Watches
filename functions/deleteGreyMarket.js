const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log('🗑️ Delete Grey Market Function STARTED');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const model = body.Model || body.model;
    if (!model) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Model is required for deletion' }) };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // Adjust as needed
    const collection = db.collection('grey_market_refs');

    const result = await collection.deleteOne({ Model: model });
    console.log('✅ Delete result:', result);

    if (result.deletedCount === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Model not found' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Deleted successfully' }) };
  } catch (err) {
    console.error('💥 ERROR during deletion:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};
