// functions/_lib/mongo.js
const { MongoClient } = require('mongodb');

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set');
    clientPromise = new MongoClient(uri, { maxPoolSize: 5 }).connect();
  }
  return clientPromise;
}

async function getDb(dbName) {
  const client = await getClient();
  return client.db(dbName || process.env.MONGO_DB);
}

module.exports = { getDb };
