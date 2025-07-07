// /netlify/functions/greyMarketLookup.js

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async function (event) {
  console.log('🔍 Grey Market Lookup STARTED');

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const ref = event.queryStringParameters.reference;

  if (!ref) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing reference query param' }),
    };
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
    console.log('✅ MongoDB connected');
  } else {
    console.log('♻️ Reusing cached MongoDB client');
  }

  const db = cachedClient.db('test'); // or your DB name
  const collection = db.collection('grey_market_refs');

  const results = await collection.find({ "Reference Number": ref }).toArray();

  console.log(`✅ Found ${results.length} records for ${ref}`);

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
