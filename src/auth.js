// src/auth.js
// Client auth gate for LuxeTime: Passkeys + password fallback + UI gating
// Requires Netlify Functions: beginRegistration, verifyRegistration,
// beginAuthentication, verifyAuthentication, loginWithPassword, sessionStatus

(function () {
  // ---------- Helpers ----------
  function b64urlToBuf(b64url) {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
    const b64 = (b64url.replace(/-/g, '+').replace(/_/g, '/')) + pad;
    const str = atob(b64);
    const buf = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
    return buf.buffer;
  }
  function bufToB64url(buf) {
    const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  async function getJSON(url) {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, json: text }; }
  }
  async function postJSON(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const text = await res.text();
    try { return { ok: res.ok, status: res.status, json: JSON.parse(text) }; }
    catch { return { ok: res.ok, status: res.status, json: text }; }
  }

  // ---------- UI gating ----------
  const grid = document.querySelector('.lookup-grid'); // main content grid
  const gmBtn = document.getElementById('gmSearchBtn');
  const refBtn = document.getElementById('refLookupBtn');

  function showApp() {
    if (grid) grid.style.display = '';
    if (gmBtn) { gmBtn.disabled = false; gmBtn.style.filter = ''; gmBtn.style.pointerEvents = '';}
    if (refBtn) { refBtn.disabled = false; refBtn.style.filter = ''; refBtn.style.pointerEvents = '';}
  }
  function showAuthOnly() {
    if (grid) grid.style.display = 'none';
    if (gmBtn) { gmBtn.disabled = true; gmBtn.style.filter = 'grayscale(1)'; gmBtn.style.pointerEvents = 'none';}
    if (refBtn) { refBtn.disabled = true; refBtn.style.filter = 'grayscale(1)'; refBtn.style.pointerEvents = 'none';}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function refreshGate() {
    try {
      const r = await getJSON('/.netlify/functions/sessionStatus');
      if (r.ok && r.json && r.json.authenticated) showApp();
      else showAuthOnly();
    } catch {
      showAuthOnly();
    }
  }

  document.addEventListener('DOMContentLoaded', refreshGate);

  // ---------- Globals expected by index.html ----------
  // Create Passkey (registration)
  window.createPasskey = async function createPasskey() {
    try {
      console.debug('[auth] beginRegistration →');
      const br = await getJSON('/.netlify/functions/beginRegistration');
      if (!br.ok) throw new Error('beginRegistration HTTP ' + br.status);
      const opts = br.json && (br.json.options || br.json);

      // Convert base64url fields to ArrayBuffers
      const publicKey = Object.assign({}, opts.publicKey);
      publicKey.challenge = b64urlToBuf(publicKey.challenge);
      if (publicKey.user && typeof publicKey.user.id === 'string') {
        publicKey.user = Object.assign({}, publicKey.user, { id: b64urlToBuf(publicKey.user.id) });
      }

      const cred = await navigator.credentials.create({ publicKey });
      if (!cred) throw new Error('navigator.credentials.create returned null');

      const attObj = {
        id: cred.id,
        type: cred.type,
        rawId: bufToB64url(cred.rawId),
        response: {
          attestationObject: bufToB64url(cred.response.attestationObject),
          clientDataJSON: bufToB64url(cred.response.clientDataJSON),
        }
      };

      const vr = await postJSON('/.netlify/functions/verifyRegistration', { attestation: attObj });
      if (!vr.ok) throw new Error('verifyRegistration HTTP ' + vr.status + ' ' + JSON.stringify(vr.json));

      console.debug('[auth] verifyRegistration ✔', vr.json);
      // Server sets the session cookie on success.
      await refreshGate();
      alert('Passkey created! You are signed in.');
    } catch (e) {
      console.error('[auth] createPasskey error', e);
      alert('Could not create passkey: ' + e.message);
    }
  };

  // Sign-in with Passkey (authentication)
  window.signInWithPasskey = async function signInWithPasskey() {
    try {
      console.debug('[auth] beginAuthentication →');
      const ba = await getJSON('/.netlify/functions/beginAuthentication');
      if (!ba.ok) throw new Error('beginAuthentication HTTP ' + ba.status);
      const opts = ba.json && (ba.json.options || ba.json);

      const publicKey = Object.assign({}, opts.publicKey);
      publicKey.challenge = b64urlToBuf(publicKey.challenge);
      if (publicKey.allowCredentials && Array.isArray(publicKey.allowCredentials)) {
        publicKey.allowCredentials = publicKey.allowCredentials.map(c => ({
          type: c.type,
          id: b64urlToBuf(c.id),
          transports: c.transports
        }));
      }

      const assertion = await navigator.credentials.get({ publicKey });
      if (!assertion) throw new Error('navigator.credentials.get returned null');

      const asObj = {
        id: assertion.id,
        type: assertion.type,
        rawId: bufToB64url(assertion.rawId),
        response: {
          authenticatorData: bufToB64url(assertion.response.authenticatorData),
          clientDataJSON: bufToB64url(assertion.response.clientDataJSON),
          signature: bufToB64url(assertion.response.signature),
          userHandle: assertion.response.userHandle ? bufToB64url(assertion.response.userHandle) : null,
        }
      };

      const vr = await postJSON('/.netlify/functions/verifyAuthentication', { assertion: asObj });
      if (!vr.ok) throw new Error('verifyAuthentication HTTP ' + vr.status + ' ' + JSON.stringify(vr.json));

      console.debug('[auth] verifyAuthentication ✔', vr.json);
      await refreshGate();
      alert('Signed in!');
    } catch (e) {
      console.error('[auth] signInWithPasskey error', e);
      alert('Could not sign in with passkey: ' + e.message);
    }
  };

  // Password fallback (Netlify Function: loginWithPassword)
  window.loginWithPasswordPrompt = async function loginWithPasswordPrompt() {
    try {
      const pwd = prompt('Enter access password');
      if (!pwd) return;
      const r = await postJSON('/.netlify/functions/loginWithPassword', { password: pwd });
      if (!r.ok) throw new Error('login HTTP ' + r.status);
      await refreshGate();
      alert('Signed in with password');
    } catch (e) {
      console.error('[auth] login error', e);
      alert('Password login failed: ' + e.message);
    }
  };

  window.logout = async function logout() {
    try {
      await fetch('/.netlify/functions/sessionStatus?logout=1', { method: 'POST', credentials: 'include' });
    } finally {
      await refreshGate();
    }
  };
})();
