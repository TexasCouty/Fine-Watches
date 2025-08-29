// functions/sessionStatus.js
// Simple status & logout endpoint used by src/auth.js
const { read, clear, NAME } = require('./_lib/session');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'POST' && (event.queryStringParameters || {}).logout) {
      // Clear cookie to logout
      return {
        statusCode: 200,
        headers: { 'Set-Cookie': clear(NAME) },
        body: JSON.stringify({ authenticated: false, ok: true })
      };
    }

    const sid = read({ headers: event.headers }, NAME);
    return {
      statusCode: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({ authenticated: !!sid })
    };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ authenticated: false }) };
  }
};
