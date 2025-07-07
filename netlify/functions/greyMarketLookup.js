const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;

exports.handler = async (event) => {
  const client = new MongoClient(uri);
  try {
    const ref = event.queryStringParameters.reference || '';
    console.log('🔍 Searching for:', ref);

    await client.connect();
    const db = client.db('test');
    const coll = db.collection('grey_market');

    const results = await coll.find({
      Model: { $regex: ref, $options: 'i' }
    }).sort({ "Date Entered": 1 }).toArray();

    console.log('✅ Results found:', results.length);

    return {
      statusCode: 200,
      body: JSON.stringify(results)
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.toString() }) };
  } finally {
    await client.close();
  }
};
