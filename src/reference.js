'use strict';
/* Reference lookup with full-width detail dock (image on RIGHT).
   - Event delegation for row selection (fixes "always last row" bug)
   - Verbose logging on search & selection
   - Clears the search input after results load
   - Expands top-level fields + Calibre (nested) + Specs (nested)
*/

const refEls = {
  input: document.getElementById('referenceInput'),
  btn: document.getElementById('referenceBtn'),
  out: document.getElementById('referenceOut'),
  dock: document.getElementById('detailDock'),
};

const refState = { list: [], selectedIndex: -1 };

document.addEventListener('DOMContentLoaded', () => {
  refEls.btn?.addEventListener('click', runRef);
  refEls.input?.addEventListener('keydown', (e)=> {
    if (e.key === 'Enter') { e.preventDefault(); runRef(); }
  });

  // Event delegation: one listener handles all current/future rows
  refEls.out?.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = Number(tr.dataset.idx);
    console.log('[Ref] row click -> idx', idx);
    selectRef(idx);
  });
  refEls.out?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    e.preventDefault();
    const idx = Number(tr.dataset.idx);
    console.log('[Ref] row key -> idx', idx);
    selectRef(idx);
  });

  window.addEventListener('resize', () => adjustDockLayout());
});

async function runRef(){
  const q = (refEls.input?.value || '').trim();
  console.log('[Ref] search term:', q);
  if (!q) { refEls.out.innerHTML = '<div class="note">Enter a reference or keywords.</div>'; clearDock(); return; }
  refEls.out.innerHTML = '<div class="skel" style="height:120px"></div>'; clearDock();

  const url = `/.netlify/functions/referenceLookUp?q=${encodeURIComponent(q)}&limit=50`;
  try {
    console.log('[Ref] GET', url);
    const r = await fetch(url);
    const text = await r.text();
    console.log('[Ref] status', r.status, 'body (first 400):', text.slice(0, 400));
    if (!r.ok) { refEls.out.innerHTML = `<div class="note">Server error (${r.status}). See console.</div>`; console.error(text); return; }
    const docs = JSON.parse(text);
    refState.list = Array.isArray(docs) ? docs : [];
    console.log('[Ref] results:', refState.list.length);

    // Auto-select first
    refState.selectedIndex = refState.list.length ? 0 : -1;
    renderRefList();
    if (refState.selectedIndex >= 0) {
      console.log('[Ref] auto-select idx 0');
      renderRefDetail(refState.list[0]);
    }

    // Clear search box for fast subsequent searches
    if (refEls.input) refEls.input.value = '';
  } catch (err) {
    console.error('[Ref] fetch error', err);
    refEls.out.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}

function renderRefList(){
  if (refState.list.length === 0) { refEls.out.innerHTML = '<div class="note">No matches.</div>'; return; }

  // Build table rows with stable data-idx
  const rows = refState.list.map((d, i)=> `
    <tr class="${i===refState.selectedIndex?'is-selected':''}" tabindex="0" role="button" data-idx="${i}">
      <td>${esc(d.Reference ?? '—')}</td>
      <td>${esc(d.Brand ?? '—')}</td>
      <td>${esc(d.Collection ?? '—')}</td>
      <td>${d.PriceAmount ? fmtUSD(d.PriceAmount) : (d.Price ? esc(d.Price) : '—')}</td>
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
}

function selectRef(i){
  if (i < 0 || i >= refState.list.length) return;
  refState.selectedIndex = i;
  console.log('[Ref] selectRef -> idx', i, 'ref=', refState.list[i]?.Reference);
  renderRefList();                         // refresh highlight
  renderRefDetail(refState.list[i]);       // show detail
}

/*────────────────────────────────────────────────────────────────────────────*/
// Detail dock (image on RIGHT)
function renderRefDetail(d){
  if (!refEls.dock) return;
  clearDock();

  const section = document.createElement('section');
  section.className = 'detail-card';
  applyRightImageLayout(section);

  // RIGHT column (media)
  const media = document.createElement('div');
  media.className = 'detail-media';
  const imgSrc = d.ImageFilename || d.ImageUrl || d.imageUrl || d.Image || d.image || '';
  if (imgSrc) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = imgSrc;
    img.alt = d.Reference || 'Reference Image';
    img.addEventListener('click', () => {
      const m = document.getElementById('imgModal');
      const mi = document.getElementById('imgModalImg');
      if (m && mi){ mi.src = imgSrc; m.classList.add('open'); }
    });
    media.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'No image';
    media.appendChild(ph);
  }

  // LEFT column (details)
  const left = document.createElement('div');

  const header = document.createElement('h3');
  header.className = 'detail-title';
  const headParts = [d.Reference, d.Brand, d.Collection].filter(Boolean).join(' • ');
  const headPrice = d.PriceAmount ? fmtUSD(d.PriceAmount) : (d.Price ? String(d.Price) : '');
  header.textContent = headPrice ? `${headParts} • ${headPrice}` : headParts || 'Reference';

  // Overview
  const grid = document.createElement('dl'); grid.className = 'detail-grid';
  addPair(grid, 'Description', d.Description);
  addPair(grid, 'Bracelet', d.Bracelet);
  addPair(grid, 'Case', d.Case);
  addPair(grid, 'Dial', d.Dial);
  addPair(grid, 'Price Currency', d.PriceCurrency);
  addPair(grid, 'Last Updated', d.LastUpdated);
  if (d.SourceURL) {
    const dt = document.createElement('dt'); dt.textContent = 'Source URL';
    const dd = document.createElement('dd'); const a = document.createElement('a');
    a.href = d.SourceURL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open';
    dd.appendChild(a); grid.append(dt, dd);
  }

  // Calibre (expanded)
  if (d.Calibre && typeof d.Calibre === 'object') {
    const cal = d.Calibre;
    const title = document.createElement('h4'); title.className = 'detail-sub'; title.textContent = 'Calibre';
    const calGrid = document.createElement('dl'); calGrid.className = 'detail-grid'; calGrid.style.marginTop = '10px';
    ['Name','Functions','Mechanism','TotalDiameter','Frequency','NumberOfJewels','PowerReserve','NumberOfParts','Thickness']
      .forEach(k => addPair(calGrid, prettify(k), cal[k]));
    left.append(title, calGrid);
  }

  // Specs (expanded)
  if (d.Specs && typeof d.Specs === 'object') {
    const sp = d.Specs;
    const title = document.createElement('h4'); title.className = 'detail-sub'; title.textContent = 'Specs';
    const spGrid = document.createElement('dl'); spGrid.className = 'detail-grid'; spGrid.style.marginTop = '10px';
    Object.keys(sp).forEach(k => addPair(spGrid, prettify(k), sp[k]));
    left.append(title, spGrid);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const closeBtn = mkBtn('Close details'); closeBtn.addEventListener('click', clearDock);
  actions.append(closeBtn);

  left.append(header, grid, actions);

  // Append LEFT (details) then RIGHT (media)
  section.append(left, media);
  refEls.dock.appendChild(section);
  adjustDockLayout();
}

function clearDock(){ if (refEls.dock) refEls.dock.innerHTML = ''; }
function applyRightImageLayout(section){
  if (window.innerWidth >= 980) section.style.gridTemplateColumns = '1fr 340px';
  else section.style.gridTemplateColumns = '';
}
function adjustDockLayout(){
  const section = document.getElementById('detailDock')?.querySelector('.detail-card');
  if (section) applyRightImageLayout(section);
}

/*────────────────────────────────────────────────────────────────────────────*/
// Helpers
function addPair(dl, k, v){
  const dt = document.createElement('dt'); dt.textContent = k;
  const dd = document.createElement('dd'); dd.textContent = (v===undefined || v===null || String(v).trim()==='') ? '—' : String(v);
  dl.append(dt, dd);
}
function mkBtn(txt){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
function esc(s){ return (s==null? '': String(s)).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function fmtUSD(v){ const n = Number(String(v).replace(/[^0-9.-]/g,'')); if (Number.isNaN(n)) return String(v); return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
function prettify(key){
  return String(key)
    .replace(/_/g,' ')
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/\s+/g,' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
