const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster';

let cachedClient = null;

exports.handler = async function (event, context) {
  const ref = event.queryStringParameters.ref;

  if (!ref) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No reference provided.' }),
    };
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }

  const db = cachedClient.db('watchlookup');
  const collection = db.collection('watch_refs');

  const results = await collection
    .find({ reference: { $regex: ref, $options: 'i' } })
    .toArray();

  if (results.length === 0) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: `Reference "${ref}" not found.` }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
