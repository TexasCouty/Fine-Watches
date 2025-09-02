'use strict';

const { generateAuthenticationOptions } = require('@simplewebauthn/server');
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
  if (cookies.length) res.multiValueHeaders = { 'Set-Cookie': cookies };
  return res;
}

exports.handler = async (event) => {
  const t0 = Date.now();
  const h = event.headers || {};
  const host = h['x-forwarded-host'] || h.host || '';
  const proto = h['x-forwarded-proto'] || 'https';
  const ua = h['user-agent'] || '';

  try {
    if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

    const RP_ID  = process.env.RP_ID  || (host ? host.split(':')[0] : '');
    const ORIGIN = process.env.ORIGIN || (host ? `${proto}://${host}` : '');
    console.log('[beginAuthentication] ▶', { host, ua, RP_ID, ORIGIN });

    if (!RP_ID || !ORIGIN) return json(500, { error: 'Missing RP_ID or ORIGIN env' });

    // We use a stable per-browser UID cookie set during registration
    const uid = read({ headers: h }, UID);
    console.log('[beginAuthentication] uid cookie present:', !!uid);

    // Build WebAuthn options
    let options;
    try {
      options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'preferred',
        // allowCredentials: []  // optional if you fetch from DB; leaving empty lets the authenticator choose
      });
    } catch (e) {
      console.error('[beginAuthentication] generateAuthenticationOptions error:', e?.message || e);
      return json(500, { error: 'generateAuthenticationOptions failed' });
    }

    // Store challenge in cookie (verifyAuthentication will read it)
    const cookies = [write(CHAL, options.challenge)];

    console.log('[beginAuthentication] ◀ ok in', Date.now() - t0, 'ms');
    return json(200, { options }, { cookies });
  } catch (err) {
    console.error('[beginAuthentication] ✖', err?.stack || String(err));
    return json(500, { error: 'beginAuthentication failed' });
  }
};
