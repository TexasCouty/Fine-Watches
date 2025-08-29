// functions/_lib/session.js
// Tiny cookie helpers for Netlify Functions
const NAME = 'lt_session';
const CHAL = 'lt_chal';
const UID  = 'lt_uid';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function cookieStr(key, val, opts) {
  const o = Object.assign({ Path: '/', HttpOnly: true, SameSite: 'Lax', Secure: true, MaxAge: MAX_AGE }, opts || {});
  const parts = [`${key}=${encodeURIComponent(val)}`];
  if (o.MaxAge != null) parts.push(`Max-Age=${o.MaxAge}`);
  if (o.Path) parts.push(`Path=${o.Path}`);
  if (o.HttpOnly) parts.push('HttpOnly');
  if (o.SameSite) parts.push(`SameSite=${o.SameSite}`);
  if (o.Secure) parts.push('Secure');
  return parts.join('; ');
}
function parseCookies(headers) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || '';
  const out = {};
  raw.split(';').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > -1) out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}
function read(req, key) {
  const c = parseCookies(req.headers || {});
  return c[key || NAME] || '';
}
function write(key, val) {
  return cookieStr(key || NAME, val);
}
function clear(key) {
  return cookieStr(key || NAME, '', { MaxAge: 0 });
}

module.exports = { NAME, CHAL, UID, MAX_AGE, parseCookies, read, write, clear };
