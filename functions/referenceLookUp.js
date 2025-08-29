// functions/referenceLookUp.js
// Reference search with diagnostics and session enforcement.

const { MongoClient } = require('mongodb');
const { read, NAME } = require('./_lib/session');

const ENV = {
  URI: process.env.MONGO_URI,
  DB: process.env.MONGO_DB || 'test',
  COLL: process.env.MONGO_REF_COLL || 'references',
};

function mask(uri) { return uri ? uri.replace(/\/\/([^@]+)@/, '//***:***@') : '<undefined>'; }
function rx(s) { return new RegExp(s, 'i'); }

// Tokenized AND-of-ORs across common fields
function buildSmartQuery(term) {
  const tokens = (term || '').split(/\s+/).filter(Boolean);
  const F = [
    'Reference', 'Brand', 'Collection', 'Description',
    'Model', 'ModelName', 'Model Name',
    'Nickname', 'Nickname or Dial',
    'Family', 'Line', 'Keywords', 'Tags',
    'Calibre.Name'
  ];
  if (tokens.length === 0) return {};
  return { $and: tokens.map(t => ({ $or: F.map(f => ({ [f]: rx(t) })) })) };
}

let cachedClient = null;

console.log('[RefLookup] Cold start');
console.log('[RefLookup] ENV MONGO_URI:', mask(ENV.URI));
console.log('[RefLookup] ENV MONGO_DB:', ENV.DB);
console.log('[RefLookup] ENV MONGO_REF_COLL:', ENV.COLL);

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!ENV.URI) throw new Error('Missing MONGO_URI');
  const client = new MongoClient(ENV.URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 });
  await client.connect();
  cachedClient = client;
  console.log('[RefLookup] ✅ Connected (client cached)');
  return cachedClient;
}

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 🔐 Require session cookie
    const sid = read({ headers: event.headers }, NAME);
    if (!sid) {
      console.warn('[RefLookup] 401: no session cookie');
      return { statusCode: 401, body: 'Unauthorized' };
    }

    const params = new URLSearchParams(event.rawQuery || '');
    const qs = event.queryStringParameters || {};
    const q = (params.get('q') || qs.q || '').trim();
    const limitRaw = params.get('limit') || qs.limit || '50';
    const limit = Math.min(parseInt(limitRaw, 10) || 50, 200);

    if (!q) {
      console.warn('[RefLookup] 400: missing q');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing query parameter ?q' }) };
    }

    console.log(`[RefLookup] ► Request q="${q}" limit=${limit}`);

    const client = await getClient();
    const coll = client.db(ENV.DB).collection(ENV.COLL);

    try {
      const est = await coll.estimatedDocumentCount();
      console.log(`[RefLookup] Collection "${ENV.COLL}" est count=${est}`);
    } catch (e) {
      console.warn('[RefLookup] Could not get estimatedDocumentCount:', e.message);
    }

    const query = buildSmartQuery(q);
    const proj = {
      Reference: 1, Brand: 1, Collection: 1, Description: 1, Details: 1,
      ImageFilename: 1, 'Calibre.Name': 1, SourceURL: 1, LastUpdated: 1,
      Aliases: 1, Specs: 1, Dial: 1, Case: 1, Bracelet: 1, Price: 1,
      PriceCurrency: 1, PriceAmount: 1,
    };

    console.time('[RefLookup] Mongo find');
    const docs = await coll.find(query, { projection: proj }).limit(limit).toArray();
    console.timeEnd('[RefLookup] Mongo find');

    const dt = Date.now() - t0;
    console.log(`[RefLookup] ◄ Response ${docs.length} docs in ${dt}ms`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(docs),
    };
  } catch (err) {
    const dt = Date.now() - t0;
    console.error('[RefLookup] ERROR:', err && err.message, 'in', dt, 'ms');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
