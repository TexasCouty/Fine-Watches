const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  try {
    const { id, fields } = JSON.parse(event.body);
    await client.connect();
    const db = client.db('test');
    const coll = db.collection('grey_market');
    await coll.updateOne({ _id: new ObjectId(id) }, { $set: fields });
    return { statusCode: 200, body: JSON.stringify({ message: 'Updated!' }) };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  } finally { await client.close(); }
};
