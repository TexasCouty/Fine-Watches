// Login fallback: compare SHA-256(password) to APP_ACCESS_PASSWORD_SHA256 and issue a session cookie.
const crypto = require('crypto');
const { write, NAME, UID } = require('./_lib/session');

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
    const { password } = JSON.parse(event.body || '{}');
    const want = process.env.APP_ACCESS_PASSWORD_SHA256;
    if (!want) return { statusCode: 500, body: JSON.stringify({ error: 'Server password not set' }) };
    if (!password) return { statusCode: 400, body: JSON.stringify({ error: 'Missing password' }) };

    const ok = sha256(password) === want;
    if (!ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) };

    // Create a basic session (reuse same cookie schema as passkey flow)
    const uid = 'pw-' + crypto.randomUUID();
    const headers = { 'Content-Type': 'application/json' };
    headers['Set-Cookie'] = [
      write(UID, uid, 60 * 60 * 24 * 180), // 180d
      write(NAME, `ok:${uid}`, 60 * 60 * 24 * 30), // 30d
    ];

    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Signed in (password)' }) };
  } catch (e) {
    console.error('[loginWithPassword] err', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'internal error' }) };
  }
};
