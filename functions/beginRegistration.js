// functions/beginRegistration.js
'use strict';

const crypto = require('crypto');
const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { UID, CHAL, read, write } = require('./_lib/session');

function json(status, body, extra = {}) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const host = headers['x-forwarded-host'] || headers.host || '';
  const proto = headers['x-forwarded-proto'] || 'https';
  const ua = headers['user-agent'] || '';

  try {
    if (event.httpMethod !== 'GET') {
      console.warn('[beginRegistration] 405 method=', event.httpMethod);
      return json(405, { error: 'Method Not Allowed' });
    }

    // Resolve env with safe fallbacks (so we can see values in logs)
    const RP_ID   = process.env.RP_ID   || (host ? host.split(':')[0] : '');
    const ORIGIN  = process.env.ORIGIN  || (host ? `${proto}://${host}` : '');
    const RP_NAME = process.env.RP_NAME || 'LuxeTime';

    console.log('[beginRegistration] ▶', {
      host, proto, ua, RP_ID, ORIGIN, RP_NAME, time: new Date().toISOString(),
    });

    if (!RP_ID || !ORIGIN) {
      console.error('[beginRegistration] Missing RP_ID or ORIGIN', { RP_ID, ORIGIN });
      return json(500, { error: 'Missing RP_ID or ORIGIN env' });
    }

    // Stable per-device uid cookie
    let uid = read({ headers }, UID);
    const setCookies = [];
    if (!uid) {
      uid = crypto.randomUUID();
      setCookies.push(write(UID, uid));
      console.log('[beginRegistration] issued uid:', uid);
    } else {
      console.log('[beginRegistration] existing uid:', uid);
    }

    // Build options (wrapped in try/catch so we never 502)
    let options;
    try {
      options = await generateRegistrationOptions({
        rpID: RP_ID,
        rpName: RP_NAME,
        userID: Buffer.from(uid),            // opaque user handle
        userName: `lt-${uid.slice(0, 8)}`,   // display only
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // FaceID/TouchID/Windows Hello
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        excludeCredentials: [], // (populate from DB later if needed)
      });
    } catch (e) {
      console.error('[beginRegistration] generateRegistrationOptions error:', e && e.message);
      return json(500, { error: 'generateRegistrationOptions failed', message: String(e.message || e) });
    }

    // Store challenge in cookie
    setCookies.push(write(CHAL, options.challenge));

    console.log('[beginRegistration] ◀ ok');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': setCookies,
      },
      body: JSON.stringify({ options }),
    };
  } catch (err) {
    console.error('[beginRegistration] ✖ uncaught:', err && err.stack ? err.stack : String(err));
    return json(500, { error: 'beginRegistration failed', message: String(err.message || err) });
  }
};
