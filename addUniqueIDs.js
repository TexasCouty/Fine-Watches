import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("ERROR: MONGO_URI environment variable not set.");
  process.exit(1);
}

async function addUniqueIDs() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db("test"); // Change 'test' to your actual DB name if different
    const collection = db.collection("grey_market_refs");

    // Find all documents missing 'Unique ID', sorted by _id ascending
    const cursor = collection.find({ "Unique ID": { $exists: false } }).sort({ _id: 1 });
    let uniqueIdCounter = 10000; // Starting Unique ID number

    for await (const doc of cursor) {
      console.log(`Adding Unique ID ${uniqueIdCounter} to document _id: ${doc._id}`);
      await collection.updateOne(
        { _id: doc._id },
        { $set: { "Unique ID": uniqueIdCounter } }
      );
      uniqueIdCounter++;
    }

    console.log("✅ Unique IDs added to all documents missing the field.");
  } catch (err) {
    console.error("❌ Error during update:", err);
  } finally {
    await client.close();
  }
}

addUniqueIDs();
