/* Reference lookup UI – calls the correct endpoint: referenceLookUp?q=... */
const refEls = {
  input: document.getElementById('referenceInput'),
  btn: document.getElementById('referenceBtn'),
  out: document.getElementById('referenceOut')
};

refEls.btn?.addEventListener('click', runRef);
refEls.input?.addEventListener('keydown', (e)=> { if(e.key==='Enter') runRef(); });

async function runRef(){
  const q = (refEls.input?.value || '').trim();
  if (!q) {
    refEls.out.innerHTML = '<div class="note">Enter a reference or keywords.</div>';
    return;
  }
  refEls.out.innerHTML = '<div class="skel" style="height:120px"></div>';
  const url = `/.netlify/functions/referenceLookUp?q=${encodeURIComponent(q)}&limit=25`;
  console.log('[Ref] GET', url);
  try {
    const r = await fetch(url);
    const text = await r.text();
    console.log('[Ref] status', r.status, 'body', text.slice(0, 500));
    if (!r.ok) {
      refEls.out.innerHTML = `<div class="note">Server error (${r.status}). See console.</div>`;
      return;
    }
    const docs = JSON.parse(text);
    renderRefList(docs);
  } catch (err) {
    console.error('[Ref] error', err);
    refEls.out.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}

function renderRefList(list) {
  if (!Array.isArray(list) || list.length === 0) {
    refEls.out.innerHTML = '<div class="note">No matches.</div>';
    return;
  }
  refEls.out.innerHTML = list.map(d => {
    const fact = [d.Reference, d.Brand, d.Collection, d.PriceAmount ? `$${Number(d.PriceAmount).toLocaleString()}` : null]
      .filter(Boolean).join(' • ');
    return `
      <div class="card">
        <h3>${escapeHtml(fact || 'Reference')}</h3>
        ${d.Description ? `<div class="sub">${escapeHtml(d.Description)}</div>` : ''}
        ${d.Calibre ? `<div class="note"><b>Caliber:</b> ${escapeHtml(d.Calibre)}</div>` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(s){ return String(s||'').replace(/[&<>]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m])); }
