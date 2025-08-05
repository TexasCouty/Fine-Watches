// netlify/functions/greyMarketLookup.js
const { MongoClient } = require('mongodb');

// Helper to parse 'Date Entered' strings (e.g., '7/21/2025' or '2025-07-21')
function parseDateString(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split(/[\/\-]/).map(Number);
  // If format is M/D/YYYY or D/M/YYYY (ambiguous), assume M/D/YYYY when month <=12
  if (parts.length === 3) {
    const [a, b, c] = parts;
    // Year is c when a/b are <=12
    if (c > 31) {
      // assume M/D/YYYY
      return new Date(c, a - 1, b);
    } else if (a > 31) {
      // assume YYYY-M-D
      return new Date(a, b - 1, c);
    }
  }
  // Fallback
  const d = new Date(dateStr);
  return isNaN(d) ? new Date(0) : d;
}

exports.handler = async (event) => {
  console.log('=== Grey Market Lookup Function Called ===');

  const uri      = process.env.MONGO_URI;
  const dbName   = process.env.MONGO_DB   || 'test';
  const collName = process.env.MONGO_COLL || 'grey_market_refs';

  console.log('ENV MONGO_URI:', uri);
  console.log('ENV MONGO_DB:', dbName);
  console.log('ENV MONGO_COLL:', collName);

  const params = event.queryStringParameters || {};
  const term   = (params.term || '').trim();
  console.log('Search term received:', term);

  if (!term) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Search term is required' }),
    };
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('MongoDB connected.');

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
    console.log('Running query:', JSON.stringify(query));

    let docs = await collection.find(query).toArray();
    console.log('Query returned', docs.length, 'docs. Sorting by date...');

    // Sort descending by Date Entered
    docs.sort((a, b) => 
      parseDateString(b['Date Entered']) - parseDateString(a['Date Entered'])
    );

    return {
      statusCode: 200,
      body: JSON.stringify(docs),
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await client.close();
    console.log('MongoDB connection closed.');
  }
};
