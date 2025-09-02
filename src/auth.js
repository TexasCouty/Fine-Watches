// src/auth.js
// Minimal passkey client: creates a passkey and signs in using your Netlify Functions.

(function () {
  // ---- base64url helpers ----
  function b64urlToBuf(b64url) {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url.replace(/-/g, '+').replace(/_/g, '/')) + pad;
    const str = atob(b64);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes.buffer;
  }
  function bufToB64url(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    const t = await r.text();
    try { return { ok: r.ok, status: r.status, json: JSON.parse(t) }; }
    catch { return { ok: r.ok, status: r.status, json: t }; }
  }
  async function postJSON(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const t = await r.text();
    try { return { ok: r.ok, status: r.status, json: JSON.parse(t) }; }
    catch { return { ok: r.ok, status: r.status, json: t }; }
  }

  // ---- 1) Create passkey ----
  window.createPasskey = async function () {
    try {
      // GET options from server
      const br = await getJSON('/.netlify/functions/beginRegistration');
      if (!br.ok) throw new Error('beginRegistration ' + br.status);
      const opts = br.json.options || br.json;     // support both shapes
      const pk = opts.publicKey || opts;           // some libs nest at publicKey

      // convert base64url -> ArrayBuffer fields
      pk.challenge = b64urlToBuf(pk.challenge);
      if (pk.user && typeof pk.user.id === 'string') pk.user.id = b64urlToBuf(pk.user.id);
      if (Array.isArray(pk.excludeCredentials)) {
        pk.excludeCredentials = pk.excludeCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
      }

      // Native sheet (Face ID / Touch ID / Windows Hello)
      const cred = await navigator.credentials.create({ publicKey: pk });
      if (!cred) throw new Error('No credential');

      const attestation = {
        id: cred.id,
        type: cred.type,
        rawId: bufToB64url(cred.rawId),
        response: {
          clientDataJSON: bufToB64url(cred.response.clientDataJSON),
          attestationObject: bufToB64url(cred.response.attestationObject),
        },
      };

      // POST to verify
      const vr = await postJSON('/.netlify/functions/verifyRegistration', { attestation });
      if (!vr.ok) throw new Error('verifyRegistration ' + vr.status + ' ' + JSON.stringify(vr.json));
      alert('Passkey created. Now Sign in.');
    } catch (e) {
      console.error('[createPasskey]', e);
      alert('Create failed: ' + e.message);
    }
  };

  // ---- 2) Sign in with passkey ----
  window.signInWithPasskey = async function () {
    try {
      const ba = await getJSON('/.netlify/functions/beginAuthentication');
      if (!ba.ok) throw new Error('beginAuthentication ' + ba.status);
      const opts = ba.json.options || ba.json;
      const pk = opts.publicKey || opts;

      pk.challenge = b64urlToBuf(pk.challenge);
      if (Array.isArray(pk.allowCredentials)) {
        pk.allowCredentials = pk.allowCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
      }

      const assertion = await navigator.credentials.get({ publicKey: pk });
      if (!assertion) throw new Error('No assertion');

      const payload = {
        assertion: {
          id: assertion.id,
          type: assertion.type,
          rawId: bufToB64url(assertion.rawId),
          response: {
            clientDataJSON: bufToB64url(assertion.response.clientDataJSON),
            authenticatorData: bufToB64url(assertion.response.authenticatorData),
            signature: bufToB64url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? bufToB64url(assertion.response.userHandle) : null,
          },
        },
      };

      const va = await postJSON('/.netlify/functions/verifyAuthentication', payload);
      if (!va.ok) throw new Error('verifyAuthentication ' + va.status + ' ' + JSON.stringify(va.json));
      alert('Signed in with passkey!');
    } catch (e) {
      console.error('[signInWithPasskey]', e);
      alert('Sign-in failed: ' + e.message);
    }
  };
})();
