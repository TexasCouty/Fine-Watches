const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  try {
    const ref = event.queryStringParameters.reference || '';
    await client.connect();
    const db = client.db('test'); // replace 'test' if your DB name is different
    const coll = db.collection('grey_market'); // replace with your collection name

    const results = await coll.find({
      Model: { $regex: ref, $options: 'i' } // ✅ partial match, case-insensitive
    }).sort({ "Date Entered": 1 }).toArray();

    return {
      statusCode: 200,
      body: JSON.stringify(results) // ✅ returns _id by default!
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.toString() }) };
  } finally {
    await client.close();
  }
};
