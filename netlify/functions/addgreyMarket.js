const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  try {
    const doc = JSON.parse(event.body);
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('grey_market');
    await coll.insertOne(doc);
    return { statusCode: 200, body: JSON.stringify({ message: 'Added!' }) };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  } finally { await client.close(); }
};
