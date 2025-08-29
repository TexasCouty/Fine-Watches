// Serverless signature for signed Cloudinary uploads
// Requires env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Optional: CLOUDINARY_UPLOAD_FOLDER (e.g., "gmdb")


const crypto = require('crypto');
const { read, NAME } = require('./_lib/session');

exports.handler = async () => {
try {
const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
const api_key = process.env.CLOUDINARY_API_KEY;
const api_secret = process.env.CLOUDINARY_API_SECRET;
const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || '';


if (!cloud_name || !api_key || !api_secret) {
return { statusCode: 500, body: JSON.stringify({ error: 'Missing Cloudinary env vars' }) };
}


const timestamp = Math.floor(Date.now() / 1000);
const paramsToSign = { timestamp, ...(folder ? { folder } : {}) };


const toSign = Object.keys(paramsToSign)
.sort()
.map(k => `${k}=${paramsToSign[k]}`)
.join('&') + api_secret;


const signature = crypto.createHash('sha1').update(toSign).digest('hex');


return {
statusCode: 200,
headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
body: JSON.stringify({ timestamp, signature, api_key, cloud_name, folder })
};
} catch (err) {
return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
}
};