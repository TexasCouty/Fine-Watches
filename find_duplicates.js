const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster';
const dbName = 'test';
const collectionName = 'grey_market_refs';

(async () => {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection(collectionName);

  const duplicates = await col.aggregate([
    { $group: { _id: "$Unique ID", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 }, _id: { $ne: null } } }
  ]).toArray();

  if (duplicates.length === 0) {
    console.log("🎉 No duplicate Unique IDs found.");
  } else {
    console.log("🚨 Duplicate Unique IDs found:\n");
    duplicates.forEach(d => {
      console.log(`Unique ID: ${d._id}\nCount: ${d.count}\nMongo _ids: ${d.docs.join(', ')}\n`);
    });
  }
  await client.close();
})();
