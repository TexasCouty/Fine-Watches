// functions/verifyAuthentication.js
const { getDb } = require('./_lib/mongo');
const { read, write, NAME, UID, CHAL } = require('./_lib/session');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

const RP_ID = process.env.RP_ID;
const ORIGIN = process.env.ORIGIN;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const headers = { 'Content-Type': 'application/json' };

    const body = JSON.parse(event.body || '{}');
    const expectedChallenge = read({ headers: event.headers }, CHAL);
    const uid = read({ headers: event.headers }, UID);
    if (!expectedChallenge || !uid) return { statusCode: 400, body: JSON.stringify({ error: 'missing challenge or uid' }) };

    const db = await getDb();
    const creds = db.collection('webauthn_credentials');

    // Stored credential for this user
    const cred = await creds.findOne({ userId: uid, credentialID: Buffer.from(body.assertion.rawId, 'base64url') });
    if (!cred) return { statusCode: 404, body: JSON.stringify({ error: 'credential not found' }) };

    const verification = await verifyAuthenticationResponse({
      response: body.assertion,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: cred.credentialID,
        credentialPublicKey: cred.publicKey,
        counter: cred.counter || 0,
        transports: cred.transports || [],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return { statusCode: 400, body: JSON.stringify({ error: 'authentication not verified' }) };
    }

    await creds.updateOne(
      { userId: uid, credentialID: cred.credentialID },
      { $set: { counter: verification.authenticationInfo?.newCounter ?? cred.counter } }
    );

    // Basic signed session cookie: "logged in"
    const set = [];
    set.push(write(NAME, `ok:${uid}`, 60 * 60 * 24)); // 24h
    headers['Set-Cookie'] = set;

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Signed in', verified: true }) };
  } catch (e) {
    console.error('[verifyAuthentication] error', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
