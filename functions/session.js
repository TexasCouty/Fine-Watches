// functions/_lib/session.js
const crypto = require('crypto');

const NAME = 'sid'; // session "logged-in" flag
const UID  = 'uid'; // your local user-id (account-per-device)
const CHAL = 'wchal'; // the WebAuthn challenge

const secret = () => (process.env.SESSION_SECRET || 'dev-secret');

function sign(v) {
  const mac = crypto.createHmac('sha256', secret()).update(v).digest('base64url');
  return `${v}.${mac}`;
}
function verify(signed) {
  if (!signed) return null;
  const p = signed.lastIndexOf('.');
  if (p < 0) return null;
  const v = signed.slice(0, p);
  const mac = signed.slice(p + 1);
  const exp = crypto.createHmac('sha256', secret()).update(v).digest('base64url');
  try { return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(exp)) ? v : null; }
  catch { return null; }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > -1) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}
function cookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax', 'Secure', 'HttpOnly'];
  if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  return parts.join('; ');
}

function read(ctx, key) {
  const c = parseCookies(ctx.headers?.cookie || ctx.headers?.Cookie || '');
  const raw = c[key];
  return raw ? verify(raw) : null;
}
function write(key, value, maxAge) {
  return cookie(key, sign(value), { maxAge });
}

module.exports = { NAME, UID, CHAL, parseCookies, read, write, sign, verify };
