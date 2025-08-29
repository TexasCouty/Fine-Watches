// functions/verifyRegistration.js
const { getDb } = require('./_lib/mongo');
const { read, UID, CHAL } = require('./_lib/session');
const { verifyRegistrationResponse } = require('@simplewebauthn/server');

const RP_ID = process.env.RP_ID;
const ORIGIN = process.env.ORIGIN;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const body = JSON.parse(event.body || '{}');

    const expectedChallenge = read({ headers: event.headers }, CHAL);
    const uid = read({ headers: event.headers }, UID);
    if (!expectedChallenge || !uid) return { statusCode: 400, body: JSON.stringify({ error: 'missing challenge or uid' }) };

    const verification = await verifyRegistrationResponse({
      response: body.attestation,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return { statusCode: 400, body: JSON.stringify({ error: 'registration not verified' }) };
    }

    const { credential } = verification;
    const db = await getDb();
    const creds = db.collection('webauthn_credentials');

    await creds.updateOne(
      { userId: uid, credentialID: credential.credentialID },
      {
        $set: {
          userId: uid,
          credentialID: credential.credentialID,          // Buffer
          publicKey: credential.credentialPublicKey,      // Buffer
          counter: credential.counter || 0,
          transports: credential.transports || [],
          backedUp: credential.backedUp ?? null,
          fmt: credential.fmt || null,
        },
      },
      { upsert: true }
    );

    return { statusCode: 200, body: JSON.stringify({ message: 'Passkey registered', verified: true }) };
  } catch (e) {
    console.error('[verifyRegistration] error', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
