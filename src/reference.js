/* Reference lookup with full-width detail card below the list
   Calls: /.netlify/functions/referenceLookUp?q=...
*/

const refEls = {
  input: document.getElementById('referenceInput'),
  btn: document.getElementById('referenceBtn'),
  out: document.getElementById('referenceOut'),
  detail: document.getElementById('refDetail'),
};

const refState = { list: [], selectedIndex: -1 };

refEls.btn?.addEventListener('click', runRef);
refEls.input?.addEventListener('keydown', (e)=> { if(e.key==='Enter') runRef(); });

async function runRef(){
  const q = (refEls.input?.value || '').trim();
  if (!q) { refEls.out.innerHTML = '<div class="note">Enter a reference or keywords.</div>'; clearRefDetail(); return; }
  refEls.out.innerHTML = '<div class="skel" style="height:120px"></div>'; clearRefDetail();
  const url = `/.netlify/functions/referenceLookUp?q=${encodeURIComponent(q)}&limit=25`;
  console.log('[Ref] GET', url);
  try {
    const r = await fetch(url);
    const text = await r.text();
    console.log('[Ref] status', r.status, 'body', text.slice(0, 500));
    if (!r.ok) { refEls.out.innerHTML = `<div class="note">Server error (${r.status}). See console.</div>`; return; }
    const docs = JSON.parse(text);
    refState.list = Array.isArray(docs) ? docs : [];
    refState.selectedIndex = -1;
    renderRefList();
  } catch (err) {
    console.error('[Ref] error', err);
    refEls.out.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}

function renderRefList(){
  if (refState.list.length === 0) { refEls.out.innerHTML = '<div class="note">No matches.</div>'; return; }
  // simple table for scan-ability
  const rows = refState.list.map((d, i)=> `
    <tr class="${i===refState.selectedIndex?'is-selected':''}" tabindex="0" role="button" data-idx="${i}">
      <td>${esc(d.Reference ?? '—')}</td>
      <td>${esc(d.Brand ?? '—')}</td>
      <td>${esc(d.Collection ?? '—')}</td>
      <td>${d.PriceAmount ? fmtPrice(d.PriceAmount) : '—'}</td>
    </tr>
  `).join('');

  refEls.out.innerHTML = `
    <div class="tablewrap">
      <table>
        <thead><tr><th>Reference</th><th>Brand</th><th>Collection</th><th>Price</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  refEls.out.querySelectorAll('tr[data-idx]')?.forEach(tr=>{
    tr.addEventListener('click', ()=> selectRef(+tr.dataset.idx));
    tr.addEventListener('keydown', (e)=> { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); selectRef(+tr.dataset.idx); } });
  });
}

function selectRef(i){
  refState.selectedIndex = i;
  renderRefList();
  renderRefDetail(refState.list[i]);
}

function renderRefDetail(d){
  if (!refEls.detail) return;
  if (!d) { clearRefDetail(); return; }

  const fact = [d.Reference, d.Brand, d.Collection, d.PriceAmount ? fmtPrice(d.PriceAmount) : null]
    .filter(Boolean).join(' • ');

  // Try any possible image property name if present in your dataset
  const possibleImg = d.ImageUrl || d.Image || d.image || null;

  const media = possibleImg
    ? `<img src="${esc(possibleImg)}" alt="${esc(d.Reference || 'Reference Image')}" loading="lazy" />`
    : `<div class="placeholder">No image</div>`;

  refEls.detail.innerHTML = `
    <section class="detail-card" role="region" aria-labelledby="refDetailTitle">
      <div class="detail-media" onclick="${possibleImg ? 'document.getElementById(\\'imgModalImg\\').src=\\''+esc(possibleImg)+'\\';document.getElementById(\\'imgModal\\').classList.add(\\'open\\');' : ''}">
        ${media}
      </div>
      <div>
        <h3 id="refDetailTitle" class="detail-title">${esc(fact || 'Reference')}</h3>
        ${d.Description ? `<div class="detail-sub">${esc(d.Description)}</div>` : ''}
        <dl class="detail-grid">
          <dt>Calibre</dt><dd>${esc(d.Calibre ?? d.Caliber ?? '—')}</dd>
          <dt>Brand</dt><dd>${esc(d.Brand ?? '—')}</dd>
          <dt>Collection</dt><dd>${esc(d.Collection ?? '—')}</dd>
          <dt>Reference</dt><dd>${esc(d.Reference ?? '—')}</dd>
          <dt>Price</dt><dd>${d.PriceAmount ? fmtPrice(d.PriceAmount) : '—'}</dd>
        </dl>
        <div class="detail-actions">
          <button class="btn" id="refDetailCloseBtn">Close details</button>
        </div>
      </div>
    </section>
  `;
  document.getElementById('refDetailCloseBtn')?.addEventListener('click', clearRefDetail);
}

function clearRefDetail(){ if (refEls.detail) refEls.detail.innerHTML = ''; }

function esc(s){ return (s==null? '': String(s)).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function fmtPrice(p){ const n=Number(p); if (Number.isNaN(n)) return '—'; return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
