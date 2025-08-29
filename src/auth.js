/* src/auth.js
   Minimal WebAuthn (Passkey/Face ID) client + UI guard for your app.
   - Detects support
   - Create passkey  → /.netlify/functions/beginRegistration → navigator.credentials.create → /verifyRegistration
   - Sign-in         → /.netlify/functions/beginAuthentication → navigator.credentials.get   → /verifyAuthentication
   - Pings           → /.netlify/functions/sessionStatus to lock/unlock UI
*/

(function () {
  'use strict';

  // ---- Small helpers (base64url <-> ArrayBuffer) -------
  function bufToB64url(buf) {
    const b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function b64urlToBuf(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob(b64 + pad);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out.buffer;
  }
  function revivePublicKeyOpts(opts) {
    // Convert challenge & any id fields (allowCredentials, user.id) back to ArrayBuffers
    if (!opts) return opts;
    const pk = Object.assign({}, opts);
    if (pk.challenge && typeof pk.challenge === 'string') pk.challenge = b64urlToBuf(pk.challenge);
    if (pk.user && typeof pk.user.id === 'string') pk.user = Object.assign({}, pk.user, { id: b64urlToBuf(pk.user.id) });
    if (Array.isArray(pk.allowCredentials)) {
      pk.allowCredentials = pk.allowCredentials.map(x => {
        if (x && typeof x.id === 'string') return Object.assign({}, x, { id: b64urlToBuf(x.id) });
        return x;
      });
    }
    return pk;
  }
  function credToJSON(cred) {
    // Serialize PublicKeyCredential for POST
    if (!cred) return null;
    const clientDataJSON = bufToB64url(cred.response.clientDataJSON);
    if (cred.response.attestationObject) {
      return {
        id: cred.id,
        rawId: bufToB64url(cred.rawId),
        type: cred.type,
        authenticatorAttachment: cred.authenticatorAttachment || null,
        response: {
          clientDataJSON,
          attestationObject: bufToB64url(cred.response.attestationObject)
        }
      };
    }
    return {
      id: cred.id,
      rawId: bufToB64url(cred.rawId),
      type: cred.type,
      authenticatorAttachment: cred.authenticatorAttachment || null,
      response: {
        clientDataJSON,
        authenticatorData: bufToB64url(cred.response.authenticatorData),
        signature: bufToB64url(cred.response.signature),
        userHandle: cred.response.userHandle ? bufToB64url(cred.response.userHandle) : null
      }
    };
  }

  // ---- DOM scaffolding: add a tiny fixed panel; requires no HTML edits ----
  function ensurePanel() {
    let panel = document.getElementById('passkeyPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'passkeyPanel';
    panel.style.cssText =
      'position:fixed;right:12px;top:12px;z-index:1001;background:#101317;border:1px solid #d4af37;color:#fff;' +
      'padding:10px 12px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);font:14px system-ui,sans-serif;';
    panel.innerHTML =
      '<div style="font-weight:600;margin-bottom:6px">Admin Access</div>' +
      '<div id="passkeyStatus" style="margin-bottom:8px;">Checking…</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button id="btnCreatePasskey" style="padding:6px 10px;border-radius:8px;border:1px solid #d4af37;background:#0f1720;color:#ffd95e;cursor:pointer">Create passkey</button>' +
        '<button id="btnSigninPasskey" style="padding:6px 10px;border-radius:8px;border:1px solid #d4af37;background:#0f1720;color:#ffd95e;cursor:pointer">Sign-in</button>' +
        '<button id="btnSignOut" style="padding:6px 10px;border-radius:8px;border:1px solid #555;background:#222;color:#bbb;cursor:pointer;display:none">Sign-out</button>' +
      '</div>';
    document.body.appendChild(panel);
    return panel;
  }

  // ---- Lock/unlock admin UI (disable edit/save/delete controls) ----
  function lockUI() {
    const ids = ['openAddBtn','saveGmBtn','cancelGmBtn','gm_delete_button'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = true; el.style.opacity = '0.55'; el.title = 'Sign in to edit'; }
    });
  }
  function unlockUI() {
    const ids = ['openAddBtn','saveGmBtn','cancelGmBtn','gm_delete_button'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.disabled = false; el.style.opacity = ''; el.title = ''; }
    });
  }

  async function getSessionStatus() {
    try {
      const r = await fetch('/.netlify/functions/sessionStatus', { headers: { 'cache-control': 'no-store' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json(); // { authenticated: boolean }
    } catch (e) {
      console.warn('[auth] sessionStatus error', e);
      return { authenticated: false };
    }
  }

  async function refreshStatusUI() {
    const s = await getSessionStatus();
    const statusEl = document.getElementById('passkeyStatus');
    const so = document.getElementById('btnSignOut');
    if (s.authenticated) {
      unlockUI();
      if (statusEl) statusEl.textContent = 'Signed in ✔';
      if (so) so.style.display = '';
    } else {
      lockUI();
      if (statusEl) statusEl.textContent = 'Signed out';
      if (so) so.style.display = 'none';
    }
  }

  async function createPasskey() {
    const statusEl = document.getElementById('passkeyStatus');
    try {
      statusEl && (statusEl.textContent = 'Preparing registration…');
      const prep = await fetch('/.netlify/functions/beginRegistration', { method: 'POST' });
      if (!prep.ok) throw new Error('beginRegistration HTTP ' + prep.status);
      const { publicKey } = await prep.json();
      if (!publicKey) throw new Error('No publicKey options from server');
      const cred = await navigator.credentials.create({ publicKey: revivePublicKeyOpts(publicKey) });
      if (!cred) throw new Error('User cancelled or no credential created');
      statusEl && (statusEl.textContent = 'Finalizing…');
      const verify = await fetch('/.netlify/functions/verifyRegistration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credToJSON(cred))
      });
      const res = await verify.json().catch(() => ({}));
      if (!verify.ok || !res?.ok) throw new Error('verifyRegistration failed');
      statusEl && (statusEl.textContent = 'Passkey created ✔');
      await refreshStatusUI();
    } catch (e) {
      console.error('[auth] createPasskey', e);
      alert('Could not create passkey: ' + e.message);
      statusEl && (statusEl.textContent = 'Error creating passkey');
    }
  }

  async function signInWithPasskey() {
    const statusEl = document.getElementById('passkeyStatus');
    try {
      statusEl && (statusEl.textContent = 'Preparing sign-in…');
      const prep = await fetch('/.netlify/functions/beginAuthentication', { method: 'POST' });
      if (!prep.ok) throw new Error('beginAuthentication HTTP ' + prep.status);
      const { publicKey } = await prep.json();
      if (!publicKey) throw new Error('No publicKey options from server');
      const cred = await navigator.credentials.get({ publicKey: revivePublicKeyOpts(publicKey) });
      if (!cred) throw new Error('User cancelled or no credential');
      statusEl && (statusEl.textContent = 'Verifying…');
      const verify = await fetch('/.netlify/functions/verifyAuthentication', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credToJSON(cred))
      });
      const res = await verify.json().catch(() => ({}));
      if (!verify.ok || !res?.ok) throw new Error('verifyAuthentication failed');
      statusEl && (statusEl.textContent = 'Signed in ✔');
      await refreshStatusUI();
    } catch (e) {
      console.error('[auth] signIn', e);
      alert('Sign-in failed: ' + e.message);
      statusEl && (statusEl.textContent = 'Sign-in error');
    }
  }

  async function signOut() {
    try {
      await fetch('/.netlify/functions/sessionStatus?logout=1', { method: 'POST' }); // this function clears the cookie when logout=1
    } catch {}
    await refreshStatusUI();
  }

  // ---- Init on page load ----
  document.addEventListener('DOMContentLoaded', async function () {
    ensurePanel();

    const supported = !!(window.PublicKeyCredential && navigator.credentials);
    if (!supported) {
      const s = document.getElementById('passkeyStatus');
      if (s) s.textContent = 'Passkeys not supported on this device/browser';
      lockUI();
      return;
    }

    document.getElementById('btnCreatePasskey')?.addEventListener('click', createPasskey);
    document.getElementById('btnSigninPasskey')?.addEventListener('click', signInWithPasskey);
    document.getElementById('btnSignOut')?.addEventListener('click', signOut);

    // First paint: lock until we know
    lockUI();
    await refreshStatusUI();
  });
})();
