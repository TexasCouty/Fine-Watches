// functions/referenceLookUp.js
// Reference search (Audemars Piguet, etc.) with detailed diagnostics.
// - Logs which DB/collection are used (without exposing secrets)
// - Reuses the Mongo client across invocations
// - Partial, case-insensitive match on Reference/Brand/Collection/Description

const { MongoClient } = require('mongodb');

const ENV = {
  URI: process.env.MONGO_URI,
  DB: process.env.MONGO_DB || 'test',
  COLL: process.env.MONGO_REF_COLL || 'references',
};

// ---- Helpers ---------------------------------------------------------------

/** Mask credentials in a Mongo URI for safe logging */
function maskMongoUri(uri) {
  if (!uri) return '<undefined>';
  try {
    // Replace credential block between '://' and '@'
    return uri.replace(/\/\/([^@]+)@/, '//***:***@');
  } catch {
    return '<unparseable>';
  }
}

/** Build case-insensitive partial-match query */
function buildQuery(term) {
  const rx = new RegExp(term, 'i');
  return {
    $or: [
      { Reference: rx },
      { Brand: rx },
      { Collection: rx },
      { Description: rx },
    ],
  };
}

// Cache the client across hot invocations
let cachedClient = null;

// Cold start log (runs once per function boot)
console.log('[RefLookup] Cold start');
console.log('[RefLookup] ENV MONGO_URI:', maskMongoUri(ENV.URI));
console.log('[RefLookup] ENV MONGO_DB:', ENV.DB);
console.log('[RefLookup] ENV MONGO_REF_COLL:', ENV.COLL);

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!ENV.URI) {
    throw new Error('Missing MONGO_URI in environment');
  }
  const client = new MongoClient(ENV.URI, {
    // modern driver options
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  cachedClient = client;
  console.log('[RefLookup] ✅ Connected to Mongo (client cached)');
  return cachedClient;
}

// ---- Handler ---------------------------------------------------------------

exports.handler = async (event) => {
  const t0 = Date.now();

  try {
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const params = new URLSearchParams(event.rawQuery || event.queryStringParameters || '');
    const q = (params.get ? params.get('q') : (event.queryStringParameters?.q || '')).trim();
    const limit = Math.min(
      parseInt(params.get ? (params.get('limit') || '50') : (event.queryStringParameters?.limit || '50'), 10) || 50,
      200
    );

    if (!q) {
      console.warn('[RefLookup] 400: missing q');
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing query parameter ?q' }) };
    }

    // Log request summary (no secrets)
    console.log(`[RefLookup] ► Request q="${q}" limit=${limit}`);

    const client = await getClient();
    const db = client.db(ENV.DB);
    const coll = db.collection(ENV.COLL);

    const query = buildQuery(q);

    console.time('[RefLookup] Mongo find');
    const cursor = coll
      .find(query, {
        projection: {
          _id: 0,
          Reference: 1,
          Brand: 1,
          Collection: 1,
          Description: 1,
          ImageFilename: 1,
          Calibre: 1,
          SourceURL: 1,
          Price: 1,
          PriceCurrency: 1,
          PriceAmount: 1,
        },
      })
      .limit(limit);
    const docs = await cursor.toArray();
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
    // Sanitize message
    const msg = (err && err.message) ? err.message.replace(/mongodb\+srv:[^ ]+/g, '***') : String(err);
    console.error(`[RefLookup] ✖ Error after ${dt}ms:`, msg);

    // Return minimal info to the client; full detail stays in logs
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'Internal error querying references' }),
    };
  }
};
