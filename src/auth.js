// src/auth.js
(function () {
  'use strict';

  // ===== Helpers: base64url <-> ArrayBuffer =====
  function b64urlToBuf(b64url) {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    return buf;
  }
  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  // HTTP helper (includes cookies for same-origin Netlify functions)
  async function api(path, body) {
    const opts = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' }
      : { method: 'GET', credentials: 'include' };
    const res = await fetch('/.netlify/functions/' + path, opts);
    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { error: 'Bad JSON', raw: text }; }
    if (!res.ok) throw new Error(json && json.error ? json.error : ('HTTP ' + res.status));
    return json;
  }

  // ===== Public API =====
  async function createPasskey() {
    if (!('credentials' in navigator)) return alert('WebAuthn not supported in this browser.');
    const { options } = await api('beginRegistration');

    // Prepare binary fields
    options.challenge = b64urlToBuf(options.challenge);
    options.user.id = b64urlToBuf(options.user.id);
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
    }

    const cred = await navigator.credentials.create({ publicKey: options });
    if (!cred) throw new Error('No credential');

    const att = {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      response: {
        attestationObject: bufToB64url(cred.response.attestationObject),
        clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      }
    };
    const result = await api('verifyRegistration', { attestation: att });
    alert(result.message || 'Passkey created!');
    return result;
  }

  async function signInWithPasskey() {
    if (!('credentials' in navigator)) return alert('WebAuthn not supported in this browser.');
    const { options } = await api('beginAuthentication');

    options.challenge = b64urlToBuf(options.challenge);
    if (options.allowCredentials) {
      options.allowCredentials = options.allowCredentials.map(c => ({ ...c, id: b64urlToBuf(c.id) }));
    }

    const assertion = await navigator.credentials.get({ publicKey: options });
    if (!assertion) throw new Error('No assertion');

    const res = {
      id: assertion.id,
      rawId: bufToB64url(assertion.rawId),
      type: assertion.type,
      response: {
        authenticatorData: bufToB64url(assertion.response.authenticatorData),
        clientDataJSON: bufToB64url(assertion.response.clientDataJSON),
        signature: bufToB64url(assertion.response.signature),
        userHandle: assertion.response.userHandle ? bufToB64url(assertion.response.userHandle) : null,
      }
    };
    const ok = await api('verifyAuthentication', { assertion: res });
    alert(ok.message || 'Signed in!');
    return ok;
  }

  // Expose to window
  window.createPasskey = createPasskey;
  window.signInWithPasskey = signInWithPasskey;
})();
