// netlify/functions/greyMarketLookup.js

const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;
let cachedClient = null;

exports.handler = async (event) => {
  console.log("=== Grey Market Lookup Function Called ===");

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Only GET requests are allowed' }),
    };
  }

  const rawQuery = event.queryStringParameters?.query || '';
  const queryTerm = rawQuery.trim();

  console.log("Search term received:", queryTerm);

  if (!queryTerm) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing search term' }),
    };
  }

  const regex = { $regex: queryTerm, $options: 'i' };

  // === Updated unified search query ===
  const mongoQuery = {
    $or: [
      { Model: regex },
      { "Model Name": regex },
      { "Unique ID": regex },
      { "Nickname or Dial": regex },
      { Dial: regex }
    ]
  };

  try {
    if (!cachedClient) {
      console.log("Connecting to MongoDB...");
      cachedClient = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      await cachedClient.connect();
      console.log("MongoDB connected successfully.");
    }

    const dbName = process.env.MONGODB_DB || 'luxetime';
    const db = cachedClient.db(dbName);
    const collection = db.collection('grey_market');

    console.log("Running query:", JSON.stringify(mongoQuery));
    const results = await collection
      .find(mongoQuery)
      .sort({ "Date Entered": -1 })
      .toArray();

    console.log(`Query returned ${results.length} results.`);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error("Error during MongoDB query:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
