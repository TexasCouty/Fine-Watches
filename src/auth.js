// src/auth.js
// Full-screen gate; matches your server's expected payloads:
// - beginRegistration/beginAuthentication -> GET returning { options }
// - verifyRegistration expects { attestation: ... }
// - verifyAuthentication expects { assertion: ... }

(function () {
  const GATE_ID = 'ltx-auth-gate';

  // Base64url helpers
  const enc = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const dec = (s) => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)).buffer;

  function reviveRegOptions(opts) {
    const o = { ...opts };
    o.challenge = dec(o.challenge);
    if (o.user && typeof o.user.id === 'string') o.user = { ...o.user, id: dec(o.user.id) };
    if (Array.isArray(o.excludeCredentials)) o.excludeCredentials = o.excludeCredentials.map(c => ({ ...c, id: dec(c.id) }));
    return o;
  }
  function reviveAuthOptions(opts) {
    const o = { ...opts };
    o.challenge = dec(o.challenge);
    if (Array.isArray(o.allowCredentials)) o.allowCredentials = o.allowCredentials.map(c => ({ ...c, id: dec(c.id) }));
    return o;
  }

  function mountGate() {
    if (document.getElementById(GATE_ID)) return;
    const style = document.createElement('style');
    style.textContent = `
      #${GATE_ID}{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#0b0f14}
      #${GATE_ID} .panel{width:min(520px,90vw);border:1px solid #d4af37;border-radius:14px;padding:22px;background:#0f141b;color:#eee;box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,"Helvetica Neue",Arial}
      #${GATE_ID} h1{margin:0 0 6px;font-size:22px;letter-spacing:.5px}
      #${GATE_ID} p{margin:8px 0 18px;opacity:.85}
      #${GATE_ID} .btn{display:inline-block;margin:6px 8px 0;padding:10px 14px;border:1px solid #d4af37;border-radius:10px;color:#111;background:#d4af37;font-weight:600;cursor:pointer;user-select:none}
      #${GATE_ID} .btn.secondary{background:transparent;color:#d4af37}
      #${GATE_ID} .note{margin-top:10px;font-size:13px;opacity:.8}
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = GATE_ID;
    div.innerHTML = `
      <div class="panel">
        <h1>Unlock LuxeTime</h1>
        <p>Use Face ID / Touch ID (Passkey). After sign-in, the app will unlock.</p>
        <div><button id="btnCreatePk" class="btn">Create passkey</button></div>
        <div><button id="btnSigninPk" class="btn secondary">Sign in with passkey</button></div>
        <div class="note" id="pkNote"></div>
      </div>`;
    document.body.appendChild(div);

    document.getElementById('btnCreatePk').onclick = onCreate;
    document.getElementById('btnSigninPk').onclick = onSignin;
  }
  function unmountGate() {
    document.getElementById(GATE_ID)?.remove();
  }
  function note(msg) {
    const n = document.getElementById('pkNote'); if (n) n.textContent = msg || '';
  }

  async function hasSession() {
    try {
      const r = await fetch('/.netlify/functions/sessionStatus', { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      return !!j.authenticated;
    } catch { return false; }
  }

  async function onCreate() {
    try {
      note('Preparing registration…');
      const br = await fetch('/.netlify/functions/beginRegistration', { credentials: 'include' });
      if (!br.ok) throw new Error('beginRegistration HTTP ' + br.status);
      const { options } = await br.json();
      if (!options) throw new Error('No options from server');

      const cred = await navigator.credentials.create({ publicKey: reviveRegOptions(options) });
      if (!cred) throw new Error('No credential');

      const payload = {
        attestation: {
          id: cred.id,
          rawId: enc(cred.rawId),
          type: cred.type,
          response: {
            clientDataJSON: enc(cred.response.clientDataJSON),
            attestationObject: enc(cred.response.attestationObject),
          },
        }
      };

      const vr = await fetch('/.netlify/functions/verifyRegistration', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await vr.json().catch(() => ({}));
      if (!vr.ok) throw new Error(body?.error || 'verifyRegistration failed');
      note('Passkey created ✔ — now sign in');
    } catch (e) {
      console.error(e); note(e.message || 'Registration failed');
    }
  }

  async function onSignin() {
    try {
      note('Preparing sign-in…');
      const ba = await fetch('/.netlify/functions/beginAuthentication', { credentials: 'include' });
      if (!ba.ok) throw new Error('beginAuthentication HTTP ' + ba.status);
      const { options } = await ba.json();
      if (!options) throw new Error('No options from server');

      const cred = await navigator.credentials.get({ publicKey: reviveAuthOptions(options) });
      if (!cred) throw new Error('No assertion');

      const payload = {
        assertion: {
          id: cred.id,
          rawId: enc(cred.rawId),
          type: cred.type,
          response: {
            clientDataJSON: enc(cred.response.clientDataJSON),
            authenticatorData: enc(cred.response.authenticatorData),
            signature: enc(cred.response.signature),
            userHandle: cred.response.userHandle ? enc(cred.response.userHandle) : null,
          },
        }
      };

      const va = await fetch('/.netlify/functions/verifyAuthentication', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await va.json().catch(() => ({}));
      if (!va.ok) throw new Error(body?.error || 'verifyAuthentication failed');

      if (await hasSession()) { unmountGate(); }
      else note('Signed in, but session not detected — refresh and try again.');
    } catch (e) {
      console.error(e); note(e.message || 'Sign-in failed');
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    mountGate();
    if (await hasSession()) unmountGate();
  });
})();
