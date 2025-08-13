// functions/greyMarketLookup.js
// Unified search over Model, Model Name, Nickname or Dial
// - Validates query length (min 2 chars) to avoid full scans
// - Masks secrets in logs (never prints full MONGO_URI)
// - Server-side sort by "Date Entered" descending, supporting MM/DD/YYYY and YYYY-MM-DD

const { MongoClient } = require('mongodb');

const {
  MONGO_URI,
  MONGO_DB = 'test',
  MONGO_COLL = 'grey_market_refs',
} = process.env;

let cachedClient; // reused across hot invocations

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskedUri(uri) {
  if (!uri) return '';
  // mongodb+srv://username:password@host/...
  return uri.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

// CORS headers are harmless locally and on Netlify (same origin) but safe to include
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  const t0 = Date.now();

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  try {
    if (!MONGO_URI) {
      console.error('Missing MONGO_URI env var.');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Server not configured: MONGO_URI missing' }),
      };
    }

    // Parse & validate input
    const params = event.queryStringParameters || {};
    const termRaw = (params.term || '').trim();
    if (termRaw.length < 2) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Query term must be at least 2 characters.' }),
      };
    }

    const termRegex = new RegExp(escapeRegex(termRaw), 'i');

    // Build query across fields
    const mongoQuery = {
      $or: [
        { Model: { $regex: termRegex } },
        { 'Model Name': { $regex: termRegex } },
        { 'Nickname or Dial': { $regex: termRegex } },
      ],
    };

    // Connect (reuse if warm)
    if (!cachedClient) {
      console.log('Connecting to MongoDB with URI (masked):', maskedUri(MONGO_URI));
      cachedClient = new MongoClient(MONGO_URI, {
        // Modern drivers use server API versions; defaults are fine for Atlas
        // serverApi: { version: '1', strict: true, deprecationErrors: true },
      });
      await cachedClient.connect();
    }
    const db = cachedClient.db(MONGO_DB);
    const coll = db.collection(MONGO_COLL);

    // Aggregation:
    // - Match on the $or
    // - Add parsedDate by trying MM/DD/YYYY first, then YYYY-MM-DD
    // - Sort by parsedDate desc
    // - Drop helper field in output
    const pipeline = [
      { $match: mongoQuery },
      {
        $addFields: {
          parsedDate: {
            $let: {
              vars: {
                d1: {
                  $dateFromString: {
                    dateString: '$Date Entered',
                    format: '%m/%d/%Y',
                    onError: null,
                    onNull: null,
                  },
                },
                d2: {
                  $dateFromString: {
                    dateString: '$Date Entered',
                    format: '%Y-%m-%d',
                    onError: null,
                    onNull: null,
                  },
                },
              },
              in: { $ifNull: ['$$d1', '$$d2'] },
            },
          },
        },
      },
      { $sort: { parsedDate: -1 } },
      { $project: { parsedDate: 0 } },
    ];

    const docs = await coll.aggregate(pipeline, { allowDiskUse: true }).toArray();

    const ms = Date.now() - t0;
    console.log(
      `greyMarketLookup "${termRaw}" -> ${docs.length} docs in ${ms} ms (db=${MONGO_DB}, coll=${MONGO_COLL})`
    );

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(docs),
    };
  } catch (err) {
    console.error('greyMarketLookup error:', err && err.stack ? err.stack : err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

// Optional: clean shutdown on cold starts (Netlify usually handles lifecycle).
// exports.onShutdown = async () => {
//   if (cachedClient) {
//     await cachedClient.close().catch(() => {});
//     cachedClient = undefined;
//   }
// };
