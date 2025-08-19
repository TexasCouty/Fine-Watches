'use strict';
/* Reference lookup with full-width detail dock (image on RIGHT).
   - Expands top-level, Calibre (nested), and Specs (nested)
   - Clears the search input after results load
*/

const refEls = {
  input: document.getElementById('referenceInput'),
  btn: document.getElementById('referenceBtn'),
  out: document.getElementById('referenceOut'),
  dock: document.getElementById('detailDock'),
};

const refState = { list: [], selectedIndex: -1 };

refEls.btn?.addEventListener('click', runRef);
refEls.input?.addEventListener('keydown', (e)=> { if(e.key==='Enter'){ e.preventDefault(); runRef(); }});
window.addEventListener('resize', () => adjustDockLayout());

async function runRef(){
  const q = (refEls.input?.value || '').trim();
  if (!q) { refEls.out.innerHTML = '<div class="note">Enter a reference or keywords.</div>'; clearDock(); return; }
  refEls.out.innerHTML = '<div class="skel" style="height:120px"></div>'; clearDock();

  const url = `/.netlify/functions/referenceLookUp?q=${encodeURIComponent(q)}&limit=25`;
  try {
    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok) { refEls.out.innerHTML = `<div class="note">Server error (${r.status}). See console.</div>`; console.error(text); return; }
    const docs = JSON.parse(text);
    refState.list = Array.isArray(docs) ? docs : [];
    refState.selectedIndex = refState.list.length ? 0 : -1;
    renderRefList();
    if (refState.selectedIndex >= 0) renderRefDetail(refState.list[0]);

    // Clear the search box for the next query
    if (refEls.input) refEls.input.value = '';
  } catch (err) {
    console.error('[Ref] error', err);
    refEls.out.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}

function renderRefList(){
  if (refState.list.length === 0) { refEls.out.innerHTML = '<div class="note">No matches.</div>'; return; }
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
    const calGrid = document.createElement('dl'); calGrid.className = 'detail-grid';
    calGrid.style.marginTop = '10px';
    const title = document.createElement('h4'); title.className = 'detail-sub'; title.textContent = 'Calibre';
    ['Name','Functions','Mechanism','TotalDiameter','Frequency','NumberOfJewels','PowerReserve','NumberOfParts','Thickness']
      .forEach(k => addPair(calGrid, prettify(k), cal[k]));
    left.append(title, calGrid);
  }

  // Specs (expanded)
  if (d.Specs && typeof d.Specs === 'object') {
    const sp = d.Specs;
    const spGrid = document.createElement('dl'); spGrid.className = 'detail-grid';
    spGrid.style.marginTop = '10px';
    const title = document.createElement('h4'); title.className = 'detail-sub'; title.textContent = 'Specs';
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
