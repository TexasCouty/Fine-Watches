const { MongoClient } = require("mongodb");
require("dotenv").config();

exports.handler = async function (event) {
  console.log("=== Grey Market Lookup Function Called ===");

  const term = event.queryStringParameters.term || "";
  console.log("Search term received:", term);

  if (!term) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Search term is required" }),
    };
  }

  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("MongoDB connected successfully.");

    const db = client.db(process.env.MONGO_DB_NAME || "WatchDB");
    const collection = db.collection(process.env.MONGO_COLLECTION || "grey_market");

    const query = {
      $or: [
        { "Model": { $regex: term, $options: "i" } },
        { "Model Name": { $regex: term, $options: "i" } },
        { "Nickname or Dial": { $regex: term, $options: "i" } }
      ]
    };

    console.log("Running query:", JSON.stringify(query));
    const results = await collection.find(query).toArray();
    console.log(`Query returned ${results.length} results.`);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error("Error in greyMarketLookup:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  } finally {
    await client.close();
  }
};
