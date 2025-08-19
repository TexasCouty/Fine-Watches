// functions/referenceLookUp.js
// Netlify Function: fuzzy reference lookup across brands

const { MongoClient } = require('mongodb');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

function getDbNameFromUri(uri) {
  try {
    const u = new URL(uri);
    const name = u.pathname.replace(/^\//, '');
    return name || 'test';
  } catch {
    return 'test';
  }
}

function escRe(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.handler = async (event) => {
  const start = Date.now();
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: 'MONGO_URI not set' }),
    };
  }

  const qRaw  = (event.queryStringParameters?.q || '').trim();
  const limit = Math.min(parseInt(event.queryStringParameters?.limit || '50', 10) || 50, 200);

  const client = new MongoClient(MONGO_URI, { ignoreUndefined: true });
  try {
    await client.connect();
    const dbName = process.env.MONGO_DB || getDbNameFromUri(MONGO_URI);
    const db = client.db(dbName);
    const col = db.collection('references');

    let results = [];
    if (qRaw) {
      const re = new RegExp(escRe(qRaw), 'i');

      // search in common fields + Aliases array
      const filter = {
        $or: [
          { Reference: re },
          { Aliases: re },                 // array of strings supported by regex
          { Description: re },
          { Brand: re },
          { Collection: re },
          { Case: re },
          { Dial: re },
          { Bracelet: re },
        ],
      };

      results = await col
        .find(filter, {
          projection: {
            _id: 0,
            Reference: 1, Brand: 1, Collection: 1, Description: 1,
            Details: 1, Case: 1, Dial: 1, Bracelet: 1,
            ImageFilename: 1, PriceAmount: 1, PriceCurrency: 1,
            Calibre: 1, SourceURL: 1, Aliases: 1, LastUpdated: 1,
          },
        })
        .limit(limit)
        .toArray();
    } else {
      // empty query: no results (you can choose to return recent items instead)
      results = [];
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        took_ms: Date.now() - start,
        count: results.length,
        results,
      }),
    };
  } catch (err) {
    console.error('referenceLookUp error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, error: err.message || 'server error' }),
    };
  } finally {
    try { await client.close(); } catch {}
  }
};
