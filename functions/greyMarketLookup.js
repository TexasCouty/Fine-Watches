// functions/greyMarketLookup.js
const { MongoClient } = require('mongodb');

exports.handler = async function(event, context) {
  console.info('=== Grey Market Lookup Function Called ===');
  const uri       = process.env.MONGO_URI;
  const dbName    = process.env.MONGO_DB    || 'test';
  const collName  = process.env.MONGO_COLL  || 'grey_market_refs';
  const termParam = (event.queryStringParameters||{}).term || '';

  console.info('ENV MONGO_URI:', uri);
  console.info('Search term received:', termParam);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.info('MongoDB connected.');

    const coll = client.db(dbName).collection(collName);

    // Build query: empty term => all docs; otherwise regex OR.
    let query = {};
    if (termParam.trim() !== '') {
      const re = { $regex: termParam, $options: 'i' };
      query = {
        $or: [
          { Model:            re },
          { 'Model Name':     re },
          { 'Unique ID':      re },
          { 'Nickname or Dial': re },
          // if you have a "Dial" field separately:
          { Dial:             re }
        ]
      };
    }

    // Fetch & sort by “Date Entered” descending.
    const docs = await coll.find(query).toArray();
    console.info(`Query returned ${docs.length} docs. Sorting by date…`);

    docs.sort((a, b) => {
      // assume dates like "7/21/2025"
      const da = new Date(a['Date Entered']);
      const db = new Date(b['Date Entered']);
      return db - da;
    });

    console.info('MongoDB connection closed.');
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(docs)
    };

  } catch (err) {
    console.error('Lookup error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  } finally {
    await client.close();
  }
};
