// functions/referenceLookUp.js
// Reference search with detailed diagnostics and safe secret masking.

const { MongoClient } = require('mongodb');

const ENV = {
  URI: process.env.MONGO_URI,
  DB: process.env.MONGO_DB || 'test',
  COLL: process.env.MONGO_REF_COLL || 'references',
};

function mask(uri) {
  if (!uri) return '<undefined>';
  try { return uri.replace(/\/\/([^@]+)@/, '//***:***@'); }
  catch { return '<unparseable>'; }
}

function rx(s) { return new RegExp(s, 'i'); }

// More forgiving search: tokenized "AND of ORs" across common fields
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
  const client = new MongoClient(ENV.URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
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
    const db = client.db(ENV.DB);
    const coll = db.collection(ENV.COLL);

    try {
      const est = await coll.estimatedDocumentCount();
      console.log(`[RefLookup] Collection "${ENV.COLL}" est count=${est}`);
    } catch (e) {
      console.warn('[RefLookup] Could not get estimatedDocumentCount:', e.message);
    }

    const query = buildSmartQuery(q);
    console.log('[RefLookup] Query:', JSON.stringify(query));

    console.time('[RefLookup] find');
    // Return *all* fields (except _id) so we can display everything
    const docs = await coll.find(query, { projection: { _id: 0 } })
                           .limit(limit)
                           .toArray();
    console.timeEnd('[RefLookup] find');

    console.log(`[RefLookup] ◄ ${docs.length} docs in ${Date.now() - t0}ms`);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(docs),
    };
  } catch (err) {
    const msg = (err && err.message ? err.message : String(err))
      .replace(/mongodb\+srv:[^ )]+/g, '***');
    console.error(`[RefLookup] ✖ ${msg} (after ${Date.now() - t0}ms)`);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Internal error querying references' }),
    };
  }
};
