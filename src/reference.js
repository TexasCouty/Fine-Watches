'use strict';
/* Reference lookup with full-width detail card (no inline JS)
   Calls: /.netlify/functions/referenceLookUp?q=...
   Verbose logging included
*/

(function initLogging(){
  console.log('[Ref] reference.js loaded @', new Date().toISOString());
})();

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
    console.log('[Ref] status', r.status, 'raw body (first 400):', text.slice(0, 400));
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
  console.log('[Ref] select index=', i, 'doc=', refState.list[i]);
  renderRefList();
  renderRefDetail(refState.list[i]);
}

// Build the detail card with DOM API (no inline JS)
function renderRefDetail(d){
  if (!refEls.detail) return;
  if (!d) { clearRefDetail(); return; }

  refEls.detail.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'detail-card';
  section.setAttribute('role','region');
  section.setAttribute('aria-labelledby','refDetailTitle');

  // Media
  const media = document.createElement('div');
  media.className = 'detail-media';
  const possibleImg = d.ImageUrl || d.Image || d.image || null;
  if (possibleImg) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = possibleImg;
    img.alt = d.Reference || 'Reference Image';
    img.addEventListener('click', () => {
      const m = document.getElementById('imgModal');
      const mi = document.getElementById('imgModalImg');
      if (m && mi){ mi.src = possibleImg; m.classList.add('open'); }
    });
    media.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'No image';
    media.appendChild(ph);
  }

  // Right
  const right = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.id = 'refDetailTitle';
  h3.className = 'detail-title';
  const fact = [d.Reference, d.Brand, d.Collection, d.PriceAmount ? fmtPrice(d.PriceAmount) : null]
    .filter(Boolean).join(' • ');
  h3.textContent = fact || 'Reference';

  if (d.Description) {
    const sub = document.createElement('div');
    sub.className = 'detail-sub';
    sub.textContent = d.Description;
    right.appendChild(sub);
  }

  const grid = document.createElement('dl');
  grid.className = 'detail-grid';
  addPair(grid, 'Calibre', d.Calibre ?? d.Caliber);
  addPair(grid, 'Brand', d.Brand);
  addPair(grid, 'Collection', d.Collection);
  addPair(grid, 'Reference', d.Reference);
  addPair(grid, 'Price', d.PriceAmount ? fmtPrice(d.PriceAmount) : '—');

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const closeBtn = mkBtn('Close details');
  closeBtn.addEventListener('click', clearRefDetail);
  actions.appendChild(closeBtn);

  right.append(h3, grid, actions);
  section.append(media, right);
  refEls.detail.appendChild(section);
}

function clearRefDetail(){ if (refEls.detail) refEls.detail.innerHTML = ''; }

function esc(s){ return (s==null? '': String(s)).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function fmtPrice(p){ const n=Number(p); if (Number.isNaN(n)) return '—'; return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
function mkBtn(txt){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
function addPair(dl, k, v){ const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v ?? '—'; dl.append(dt, dd); }
