// functions/beginRegistration.js
const { getDb } = require('./_lib/mongo');
const { write, read, UID, CHAL, parseCookies } = require('./_lib/session');
const { generateRegistrationOptions } = require('@simplewebauthn/server');
const crypto = require('crypto');

const RP_ID = process.env.RP_ID;
const RP_NAME = process.env.RP_NAME || 'LuxeTime';

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method Not Allowed' };

    const headers = { 'Content-Type': 'application/json' };
    // session/user id (account-per-device)
    let uid = read({ headers: event.headers }, UID);
    if (!uid) {
      uid = crypto.randomUUID();
      headers['Set-Cookie'] = [ write(UID, uid, 60 * 60 * 24 * 365) ]; // 1 year
    }

    const db = await getDb();
    const users = db.collection('users');
    const creds = db.collection('webauthn_credentials');

    await users.updateOne({ _id: uid }, { $setOnInsert: { _id: uid, displayName: 'LuxeTime User' } }, { upsert: true });

    const existing = await creds.find({ userId: uid }).project({ credentialID: 1 }).toArray();
    const excludeCredentials = existing.map(c => ({ id: c.credentialID, type: 'public-key' }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: uid,
      userName: uid,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred',
        authenticatorAttachment: 'platform', // Face ID / Touch ID / Windows Hello
      },
    });

    const set = headers['Set-Cookie'] ? [].concat(headers['Set-Cookie']) : [];
    set.push(write(CHAL, options.challenge, 60 * 5)); // 5 minutes
    headers['Set-Cookie'] = set;

    return { statusCode: 200, headers, body: JSON.stringify({ options }) };
  } catch (e) {
    console.error('[beginRegistration] error', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
