'use strict';

const { getDb } = require('./_lib/mongo');
const { read, UID, CHAL } = require('./_lib/session');
const { verifyRegistrationResponse } = require('@simplewebauthn/server');

const RP_ID  = process.env.RP_ID;
const ORIGIN = process.env.ORIGIN;

function json(status, body, { headers = {} } = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    // Body shape check
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'invalid JSON body' }); }
    if (!body || !body.attestation || !body.attestation.rawId) {
      return json(400, { error: 'missing attestation' });
    }

    // Cookies we set in beginRegistration
    const expectedChallenge = read({ headers: event.headers }, CHAL);
    const uid = read({ headers: event.headers }, UID);
    if (!expectedChallenge || !uid) {
      return json(400, { error: 'missing challenge or uid cookie' });
    }
    console.log('[verifyRegistration] ▶ cookies present:', { chal: !!expectedChallenge, uid: !!uid });

    // Verify with simplewebauthn
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.attestation,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
      });
    } catch (e) {
      console.error('[verifyRegistration] verify error:', e?.message || e);
      return json(400, { error: 'attestation verify failed' });
    }

    if (!verification.verified) {
      console.warn('[verifyRegistration] not verified');
      return json(400, { error: 'registration not verified' });
    }

    // Persist credential (public key, id, counter)
    const regInfo = verification.registrationInfo || {};
    const db = await getDb();
    const creds = db.collection('webauthn_credentials');
    await creds.updateOne(
      { userId: uid, credentialID: regInfo.credentialID },
      {
        $set: {
          userId: uid,
          credentialID: regInfo.credentialID,
          publicKey: regInfo.credentialPublicKey,
          counter: regInfo.counter || 0,
          transports: regInfo.transports || [],
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log('[verifyRegistration] ◀ ok in', Date.now() - t0, 'ms');
    // Do NOT set session here; session is set on verifyAuthentication (sign-in)
    return json(200, { ok: true, message: 'Passkey registered' });
  } catch (err) {
    console.error('[verifyRegistration] ✖', err?.stack || String(err));
    return json(500, { error: 'internal error' });
  }
};
