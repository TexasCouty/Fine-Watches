// netlify/functions/greyMarketLookup.js
const { MongoClient } = require('mongodb');

const uri      = process.env.MONGO_URI;
const dbName   = process.env.MONGO_DB   || 'test';
const collName = process.env.MONGO_COLL || 'grey_market_refs';

exports.handler = async (event, context) => {
  console.log('=== Grey Market Lookup Function Called ===');
  console.log('ENV MONGO_URI:', uri);
  console.log('ENV MONGO_DB:', dbName);
  console.log('ENV MONGO_COLL:', collName);

  const params = event.queryStringParameters || {};
  const term   = (params.term || params.reference || '').trim();
  console.log('Search term received:', JSON.stringify(term));

  if (!term) {
    console.log('❌ No search term—returning 400');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Search term is required' }),
    };
  }

  console.log('🔗 Connecting to MongoDB…');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ MongoDB connected successfully.');

    const collection = client.db(dbName).collection(collName);
    const query = {
      $or: [
        { Model:            { $regex: term, $options: 'i' } },
        { 'Model Name':     { $regex: term, $options: 'i' } },
        { 'Unique ID':      { $regex: term, $options: 'i' } },
        { 'Nickname or Dial': { $regex: term, $options: 'i' } },
        { Dial:             { $regex: term, $options: 'i' } },
      ],
    };
    console.log('📋 Running query:', JSON.stringify(query));

    const docs = await collection.find(query).toArray();
    console.log(`📊 Query returned ${docs.length} document(s).`);
    if (docs.length > 0) {
      console.log('📝 First document sample:', JSON.stringify(docs[0]));
    }

    return {
      statusCode: 200,
      body: JSON.stringify(docs),
    };
  } catch (error) {
    console.error('❌ Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await client.close();
    console.log('🔒 MongoDB connection closed.');
  }
};
