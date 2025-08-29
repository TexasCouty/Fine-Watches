// functions/beginAuthentication.js
const { getDb } = require('./_lib/mongo');
const { write, read, UID, CHAL } = require('./_lib/session');
const { generateAuthenticationOptions } = require('@simplewebauthn/server');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

    const headers = { 'Content-Type': 'application/json' };
    const uid = read({ headers: event.headers }, UID);
    if (!uid) return { statusCode: 401, body: JSON.stringify({ error: 'no user (create passkey first)' }) };

    const db = await getDb();
    const creds = db.collection('webauthn_credentials');
    const existing = await creds.find({ userId: uid }).toArray();
    if (existing.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'no credentials found' }) };

    const allowCredentials = existing.map(c => ({
      id: c.credentialID, // Buffer
      type: 'public-key',
      transports: c.transports || [],
    }));

    const options = await generateAuthenticationOptions({
      allowCredentials,
      userVerification: 'preferred',
      timeout: 90_000,
    });

    headers['Set-Cookie'] = write(CHAL, options.challenge, 60 * 5);
    return { statusCode: 200, headers, body: JSON.stringify({ options }) };
  } catch (e) {
    console.error('[beginAuthentication] error', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
