// functions/_lib/mongo.js
const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_URI;
const DB  = process.env.MONGO_DB || 'test';

let client;
async function getDb() {
  if (!client) {
    if (!URI) throw new Error('Missing MONGO_URI');
    client = new MongoClient(URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
    await client.connect();
  }
  return client.db(DB);
}
module.exports = { getDb };
