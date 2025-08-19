// functions/greyMarketLookup.js
// Unified GM search (Model, Model Name, Nickname or Dial) with diagnostics.

const { MongoClient } = require('mongodb');

const ENV = {
  URI: process.env.MONGO_URI,
  DB: process.env.MONGO_DB || 'test',
  COLL: process.env.MONGO_COLL || 'grey_market_refs',
};

function mask(uri) {
  if (!uri) return '<undefined>';
  return uri.replace(/\/\/([^@]+)@/, '//***:***@');
}

function buildQuery(term) {
  const rx = new RegExp(term, 'i');
  return {
    $or: [
      { Model: rx },
      { 'Model Name': rx },
      { 'Nickname or Dial': rx },
      { 'Unique ID': rx }, // handy sometimes
    ],
  };
}

let cachedClient = null;

console.log('[GM] Cold start');
console.log('[GM] ENV MONGO_URI:', mask(ENV.URI));
console.log('[GM] ENV MONGO_DB:', ENV.DB);
console.log('[GM] ENV MONGO_COLL:', ENV.COLL);

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!ENV.URI) throw new Error('Missing MONGO_URI in environment');
  const client = new MongoClient(ENV.URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 });
  await client.connect();
  cachedClient = client;
  console.log('[GM] ✅ Connected to Mongo (client cached)');
  return cachedClient;
}

exports.handler = async (event) => {
  const t0 = Date.now();

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const params = new URLSearchParams(event.rawQuery || event.queryStringParameters || '');
    const term = (params.get ? params.get('term') : event.queryStringParameters?.term || '').trim();

    if (!term) {
      console.warn('[GM] 400: missing term');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing query parameter ?term' }) };
    }

    console.log(`[GM] ► Request term="${term}"`);

    const client = await getClient();
    const coll = client.db(ENV.DB).collection(ENV.COLL);

    const query = buildQuery(term);

    console.time('[GM] Mongo find');
    const docs = await coll
      .find(query)
      .sort({ 'Date Entered': -1 })
      .limit(200)
      .toArray();
    console.timeEnd('[GM] Mongo find');

    const dt = Date.now() - t0;
    console.log(`[GM] ◄ Response ${docs.length} docs in ${dt}ms`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(docs),
    };
  } catch (err) {
    const dt = Date.now() - t0;
    const msg = (err && err.message) ? err.message.replace(/mongodb\+srv:[^ ]+/g, '***') : String(err);
    console.error(`[GM] ✖ Error after ${dt}ms:`, msg);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Internal error querying grey market' }),
    };
  }
};
