const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event) {
  console.log('📝 Update Function STARTED');

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

    if (!body.reference || !body.fields) {
      console.log('❌ Missing reference or fields');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing reference or fields' }),
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

    const db = cachedClient.db('test'); // adjust if your DB name is different
    const collection = db.collection('watch_refs');

    console.log(`🔍 Updating reference ${body.reference} with fields:`, body.fields);

    const result = await collection.updateOne(
      { reference: body.reference },
      { $set: body.fields }
    );

    console.log('✅ Mongo result:', result);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Update successful', result }),
    };

  } catch (err) {
    console.error('💥 ERROR during MongoDB update:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
