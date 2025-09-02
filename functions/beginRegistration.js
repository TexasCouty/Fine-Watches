'use strict';

const crypto = require('crypto');
const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { UID, CHAL, read, write } = require('./_lib/session');

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
  const h = event.headers || {};
  const host = h['x-forwarded-host'] || h.host || '';
  const proto = h['x-forwarded-proto'] || 'https';
  const ua = h['user-agent'] || '';

  try {
    if (event.httpMethod !== 'GET') {
      return json(405, { error: 'Method Not Allowed' });
    }

    const RP_ID   = process.env.RP_ID   || (host ? host.split(':')[0] : '');
    const ORIGIN  = process.env.ORIGIN  || (host ? `${proto}://${host}` : '');
    const RP_NAME = process.env.RP_NAME || 'LuxeTime';

    console.log('[beginRegistration] ▶', { host, proto, ua, RP_ID, ORIGIN, RP_NAME });

    if (!RP_ID || !ORIGIN) {
      return json(500, { error: 'Missing RP_ID or ORIGIN env' });
    }

    // Stable per-device uid cookie
    let uid = read({ headers: h }, UID);
    const setCookies = [];
    if (!uid) {
      uid = crypto.randomUUID();
      setCookies.push(write(UID, uid));
      console.log('[beginRegistration] issued uid:', uid);
    } else {
      console.log('[beginRegistration] existing uid:', uid);
    }

    // Build WebAuthn options
    let options;
    try {
      options = await generateRegistrationOptions({
        rpID: RP_ID,
        rpName: RP_NAME,
        userID: Buffer.from(uid),
        userName: `lt-${uid.slice(0, 8)}`,
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        excludeCredentials: [],
      });
    } catch (e) {
      console.error('[beginRegistration] generateRegistrationOptions error:', e?.message || e);
      return json(500, { error: 'generateRegistrationOptions failed', message: String(e?.message || e) });
    }

    // Store challenge in cookie
    setCookies.push(write(CHAL, options.challenge));

    console.log('[beginRegistration] ◀ ok');
    return json(200, { options }, { cookies: setCookies });
  } catch (err) {
    console.error('[beginRegistration] ✖ uncaught:', err?.stack || String(err));
    return json(500, { error: 'beginRegistration failed', message: String(err?.message || err) });
  }
};
