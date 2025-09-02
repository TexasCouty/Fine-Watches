// functions/verifyAuthentication.js
'use strict';

const { getDb } = require('./_lib/mongo');
const { read, write, NAME, UID, CHAL } = require('./_lib/session');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

const RP_ID   = process.env.RP_ID;
const ORIGIN  = process.env.ORIGIN;

function json(status, body, { cookies = [], headers = {} } = {}) {
  const res = {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
    body: JSON.stringify(body),
  };
  if (cookies.length) {
    res.multiValueHeaders = { 'Set-Cookie': cookies };
  }
  return res;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'Method Not Allowed' });
    }

    // Parse request
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'invalid JSON body' });
    }
    if (!body || !body.assertion || !body.assertion.rawId) {
      return json(400, { error: 'missing assertion' });
    }

    // Challenge + uid from cookies
    const expectedChallenge = read({ headers: event.headers }, CHAL);
    const uid = read({ headers: event.headers }, UID);
    if (!expectedChallenge || !uid) {
      return json(400, { error: 'missing challenge or uid' });
    }

    // Fetch stored credential
    const db = await getDb();
    const creds = db.collection('webauthn_credentials');
    const credentialID = Buffer.from(body.assertion.rawId, 'base64url');

    const cred = await creds.findOne({ userId: uid, credentialID });
    if (!cred) {
      return json(404, { error: 'credential not found' });
    }

    // Verify assertion
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
      return json(400, { error: 'authentication not verified' });
    }

    // Update counter
    const newCounter = verification.authenticationInfo?.newCounter ?? cred.counter ?? 0;
    await creds.updateOne(
      { userId: uid, credentialID: cred.credentialID },
      { $set: { counter: newCounter } }
    );

    // Set session cookie (24h). Use multiValueHeaders for Set-Cookie.
    const cookies = [ write(NAME, `ok:${uid}`, 60 * 60 * 24) ];
    return json(200, { message: 'Signed in', verified: true }, { cookies });
  } catch (e) {
    console.error('[verifyAuthentication] error', e);
    return json(500, { error: 'internal error' });
  }
};
