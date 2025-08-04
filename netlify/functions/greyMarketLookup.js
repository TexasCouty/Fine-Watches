// netlify/functions/greyMarketLookup.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

exports.handler = async (event) => {
  console.log("=== Grey Market Lookup Function Called ===");

  try {
    const qp = event.queryStringParameters || {};
    const searchTerm = qp.term?.trim();

    console.log("Search term received:", searchTerm);
    if (!searchTerm) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Search term is required" }),
      };
    }

    console.log("Connecting to MongoDB...");
    const client = await MongoClient.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully.");

    const db         = client.db("test");                 // your DB name
    const collection = db.collection("grey_market_refs"); // your collection

    const q = {
      $or: [
        { Model:            { $regex: searchTerm, $options: "i" } },
        { "Model Name":     { $regex: searchTerm, $options: "i" } },
        { "Nickname or Dial": { $regex: searchTerm, $options: "i" } }
      ]
    };

    console.log("Running query:", JSON.stringify(q));
    const results = await collection.find(q).toArray();
    console.log(`Query returned ${results.length} results.`);

    await client.close();
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };

  } catch (err) {
    console.error("Error in greyMarketLookup:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
