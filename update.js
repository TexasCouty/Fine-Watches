const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event) {
  console.log('📝 Update Function STARTED');

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    console.log('🔍 Update body:', body);

    if (!body.reference || !body.fields) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing reference or fields' }),
      };
    }

    if (!cachedClient) {
      cachedClient = new MongoClient(uri);
      await cachedClient.connect();
      console.log('✅ MongoDB CONNECTED');
    }

    const db = cachedClient.db('test'); // ✅ match your DB
    const collection = db.collection('watch_refs');

    const result = await collection.updateOne(
      { reference: body.reference },
      { $set: body.fields }
    );

    console.log(`✅ Updated ${body.reference} with fields: ${JSON.stringify(body.fields)}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Update successful' }),
    };

  } catch (err) {
    console.error('💥 ERROR during update:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
