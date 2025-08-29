// Returns { signedIn: true/false } by reading the session cookie.
const { read, NAME } = require('./_lib/session');

exports.handler = async (event) => {
  try {
    const sid = read({ headers: event.headers }, NAME);
    return { statusCode: 200, body: JSON.stringify({ signedIn: !!sid }) };
  } catch (e) {
    console.error('[sessionStatus] err', e);
    return { statusCode: 200, body: JSON.stringify({ signedIn: false }) };
  }
};
