'use strict';
/* Grey Market list + full-width detail dock (below top cards).
   - Image column on RIGHT (compact layout)
   - Shows all GM fields you specified (incl. spaced keys)
   - Clears the search box after results load
*/

(function initLogging(){
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e.message, e.filename + ':' + e.lineno + ':' + e.colno, e.error);
  });
  console.log('[GM] main.js loaded @', new Date().toISOString());
})();

const els = {
  search: document.getElementById('searchInput'),
  gmBtn: document.getElementById('gmSearchBtn'),
  results: document.getElementById('resultsContainer'),
  count: document.getElementById('resultCount'),
  modal: document.getElementById('imgModal'),
  modalImg: document.getElementById('imgModalImg'),
  modalClose: document.getElementById('modalClose'),
  sheet: document.getElementById('editSheet'),
  sheetForm: document.getElementById('editForm'),
  sheetClose: document.getElementById('sheetClose'),
  openAddBtn: document.getElementById('openAddBtn'),
  dock: document.getElementById('detailDock'),
};

let state = {
  rows: [],
  sort: { key: 'DateEntered', dir: 'desc' },
  selectedGMIndex: -1,
};

/*────────────────────────────────────────────────────────────────────────────*/
// Events
document.addEventListener('DOMContentLoaded', () => {
  els.gmBtn?.addEventListener('click', () => {
    const v = els.search?.value || '';
    searchGreyMarket(v);
  });

  els.search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchGreyMarket(e.currentTarget.value);
    }
  });

  els.openAddBtn?.addEventListener('click', () => { els.sheetForm?.reset(); els.sheet?.classList.add('open'); });

  els.modalClose?.addEventListener('click', closeImgModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeImgModal(); });

  els.sheetClose?.addEventListener('click', closeEditSheet);
  window.addEventListener('resize', () => adjustDockLayout());
});

/*────────────────────────────────────────────────────────────────────────────*/
// Fetch & render
async function searchGreyMarket(term = '') {
  const q = (term || '').trim();
  if (!q) {
    els.results.innerHTML = '<div class="note">Enter a model, nickname, or dealer to search.</div>';
    els.count.textContent = '';
    clearDock();
    return;
  }

  try {
    showSkeletons();
    clearDock();

    const url = `/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok) {
      els.results.innerHTML = `<div class="note">Server error (${r.status}). See Functions logs.</div>`;
      els.count.textContent = '';
      return;
    }

    let data = null;
    try { data = JSON.parse(text); } catch (e) { console.error('[GM] parse fail', e); }

    state.rows = Array.isArray(data) ? data : (data?.results || []);
    safeSort();

    // Auto-select first result
    state.selectedGMIndex = state.rows.length ? 0 : -1;
    renderLists();
    if (state.selectedGMIndex >= 0) renderGMDetail(state.rows[0]);

    // Clear the search box for the next query
    if (els.search) els.search.value = '';
  } catch (err) {
    console.error('[GM] fetch error', err);
    els.results.innerHTML = `<div class="note">Network error. See console.</div>`;
    els.count.textContent = '';
  }
}

function safeSort() {
  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  state.rows.sort((a, b) => {
    const av = a?.[key], bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (!isNaN(+av) && !isNaN(+bv)) return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

/*────────────────────────────────────────────────────────────────────────────*/
// Results list + selection
function renderLists() {
  els.count.textContent = `${state.rows.length} results`;
  els.results.innerHTML = `
    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>Model</th><th>Dealer</th><th>Price</th><th>Date</th></tr>
        </thead>
        <tbody>
          ${state.rows.map((row, idx) => `
            <tr class="${idx===state.selectedGMIndex?'is-selected':''}" tabindex="0" role="button" data-idx="${idx}">
              <td>${esc(row['Model'])}</td>
              <td>${esc(getFirst(row, ['Dealer']))}</td>
              <td>${fmtUSD(getFirst(row, ['Price']))}</td>
              <td>${esc(getFirst(row, ['Date Entered','DateEntered','Date']))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Event delegation for click/keyboard
  const tb = els.results.querySelector('tbody');
  tb?.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = Number(tr.dataset.idx);
    console.log('[GM] row click -> idx', idx);
    onSelectGM(idx);
  });
  tb?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    e.preventDefault();
    const idx = Number(tr.dataset.idx);
    console.log('[GM] row key -> idx', idx);
    onSelectGM(idx);
  });
}


/*────────────────────────────────────────────────────────────────────────────*/
// Detail dock (image on RIGHT)
function renderGMDetail(row){
  if (!els.dock) return;
  clearDock();

  const section = document.createElement('section');
  section.className = 'detail-card';
  // put details first and image second; make second column fixed width
  applyRightImageLayout(section);

  // RIGHT column (media)
  const media = document.createElement('div');
  media.className = 'detail-media';
  const imgSrc = getFirst(row, ['ImageUrl','Image URL','Image','image']);
  if (imgSrc) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = imgSrc;
    img.alt = row.Model || 'Watch';
    img.addEventListener('click', () => openImgModal(imgSrc));
    media.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'No image';
    media.appendChild(ph);
  }

  // LEFT column (details)
  const left = document.createElement('div');
  const price = fmtUSD(getFirst(row, ['Price']));
  const header = document.createElement('h3');
  header.className = 'detail-title';
  header.textContent = `${esc(getFirst(row, ['Model'])) || '—'} • ${price}`;

  const sub = document.createElement('div');
  sub.className = 'detail-sub';
  sub.textContent = esc(getFirst(row, ['Date Entered','DateEntered','Date'])) || '—';

  const grid = document.createElement('dl');
  grid.className = 'detail-grid';

  // Map fields in the order you provided
  addPair(grid, 'Unique ID', prettyId(getFirst(row, ['Unique ID','uniqueId','_id'])));
  addPair(grid, 'Model Name', getFirst(row, ['Model Name','ModelName']));
  addPair(grid, 'Nickname/Dial', getFirst(row, ['Nickname or Dial','Nickname','Dial']));
  addPair(grid, 'Dealer', getFirst(row, ['Dealer']));
  addPair(grid, 'Year', getFirst(row, ['Year']));
  addPair(grid, 'Watch Year', getFirst(row, ['Watch Year']));
  addPair(grid, 'Bracelet', getFirst(row, ['Bracelet']));
  addPair(grid, 'Bracelet Metal/Color', getFirst(row, ['Bracelet Metal/Color','BraceletColor']));
  addPair(grid, 'Metal', getFirst(row, ['Metal']));
  addPairRaw(grid, 'Full Set', getFirst(row, ['Full Set','FullSet']));
  addPairRaw(grid, 'Retail Ready', getFirst(row, ['Retail Ready','RetailReady']));
  addPair(grid, 'Current Retail (Not Inc Tax)', fmtUSD(getFirst(row, ['Current Retail (Not Inc Tax)','CurrentRetail','Retail'])));
  addPair(grid, 'Reference', getFirst(row, ['reference','Reference']));
  addPair(grid, 'Date Posted', getFirst(row, ['Date Posted','DatePosted']));
  addPairRaw(grid, 'Comments', getFirst(row, ['Comments']));
  if (imgSrc) { // link to image if present
    const dt = document.createElement('dt'); dt.textContent = 'Image URL';
    const dd = document.createElement('dd'); const a = document.createElement('a');
    a.href = imgSrc; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open';
    dd.appendChild(a); grid.append(dt, dd);
  }

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const editBtn = mkBtn('Edit'); editBtn.classList.add('primary');
  editBtn.addEventListener('click', () => openEditSheet(row));
  const closeBtn = mkBtn('Close details'); closeBtn.addEventListener('click', clearDock);
  actions.append(editBtn, closeBtn);

  left.append(header, sub, grid, actions);

  // Append LEFT (details) then RIGHT (media)
  section.append(left, media);
  els.dock.appendChild(section);
  adjustDockLayout();
}

function clearDock(){ if (els.dock) els.dock.innerHTML = ''; }

function applyRightImageLayout(section){
  // Override CSS grid columns so details take full flex space and image is fixed 340px on the RIGHT.
  // Respect mobile breakpoint (style.css collapses to 1 col at <=980px)
  if (window.innerWidth >= 980) section.style.gridTemplateColumns = '1fr 340px';
  else section.style.gridTemplateColumns = '';
}
function adjustDockLayout(){
  const section = els.dock?.querySelector('.detail-card');
  if (section) applyRightImageLayout(section);
}

/*────────────────────────────────────────────────────────────────────────────*/
// Utilities
function getFirst(obj, keys){
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  return '';
}
function prettyId(v){
  if (!v) return '—';
  if (typeof v === 'string') return v;
  if (v.$oid) return v.$oid;
  try { return JSON.stringify(v); } catch { return String(v); }
}
function addPair(dl, k, v){
  const dt = document.createElement('dt'); dt.textContent = k;
  const dd = document.createElement('dd'); dd.textContent = v ? String(v) : '—';
  dl.append(dt, dd);
}
function addPairRaw(dl, k, v){
  const dt = document.createElement('dt'); dt.textContent = k;
  const dd = document.createElement('dd'); dd.textContent = (v === undefined || v === null || v === '') ? '—' : String(v);
  dl.append(dt, dd);
}
function mkBtn(txt){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
function esc(s){ return (s==null? '': String(s)).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function digitsOnly(n){ return Number(String(n).replace(/[^0-9.-]/g,'')); }
function fmtUSD(v){
  if (v===undefined || v===null || v==='') return '—';
  const n = digitsOnly(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0});
}

/*────────────────────────────────────────────────────────────────────────────*/
// Modal + Edit sheet
function openImgModal(src){ if(!src) return; els.modalImg.src = src; els.modal.classList.add('open'); }
function closeImgModal(){ els.modal.classList.remove('open'); els.modalImg.removeAttribute('src'); }

function openEditSheet(row){
  els.sheet.classList.add('open');
  els.sheetForm.reset();
  setVal('Unique ID', getFirst(row, ['Unique ID','uniqueId','_id']));
  setVal('Model', getFirst(row, ['Model']));
  setVal('Dealer', getFirst(row, ['Dealer']));
  setVal('Price', getFirst(row, ['Price']));
  setCheck('Full Set', !!getFirst(row, ['Full Set','FullSet']));
  setCheck('Retail Ready', !!getFirst(row, ['Retail Ready','RetailReady']));
  setVal('Year', getFirst(row, ['Year']));
  setVal('Metal', getFirst(row, ['Metal']));
  setVal('BraceletColor', getFirst(row, ['Bracelet Metal/Color','BraceletColor']));
  setVal('ImageUrl', getFirst(row, ['ImageUrl','Image URL','Image','image']));
}
function closeEditSheet(){ els.sheet.classList.remove('open'); }
function setVal(name, val){ const el = els.sheetForm.querySelector(`[name="${name}"]`); if (el) el.value = val || ''; }
function setCheck(name, checked){ const el = els.sheetForm.querySelector(`[name="${name}"]`); if (el && el.type === 'checkbox') el.checked = !!checked; }

/*────────────────────────────────────────────────────────────────────────────*/
// Save handler → updateGreyMarket expects { uniqueId, fields }
els.sheetForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.sheetForm);

  // Optional Cloudinary upload
  const file = fd.get('imageFile');
  if (file && file.size > 0) {
    const uploadedUrl = await uploadToCloudinarySigned(file);
    if (uploadedUrl) fd.set('ImageUrl', uploadedUrl);
  }
  fd.delete('imageFile');

  const uniqueId = fd.get('Unique ID') || '';
  if (!uniqueId) { alert('Missing Unique ID. Cannot save.'); return; }

  const fields = {};
  for (const [k, v] of fd.entries()) {
    if (k === 'Unique ID') continue;
    if (k === 'Full Set' || k === 'Retail Ready') {
      const el = els.sheetForm.querySelector(`[name="${k}"]`);
      fields[k] = !!el?.checked;
    } else if (k === 'Price') {
      fields[k] = v === '' ? v : digitsOnly(v);
    } else {
      fields[k] = v;
    }
  }

  const payload = { uniqueId, fields };
  try {
    const r = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    if (!r.ok) { alert(`Save failed (${r.status}). See console.`); console.error(text); return; }
    closeEditSheet();
    searchGreyMarket(els.search?.value || ''); // refresh
  } catch (err) {
    console.error('[GM] update error', err);
    alert('Save failed. See console.');
  }
});

/*────────────────────────────────────────────────────────────────────────────*/
// Cloudinary helper
async function uploadToCloudinarySigned(file){
  try {
    const sigRes = await fetch('/.netlify/functions/getCloudinarySignature');
    const { timestamp, signature, api_key, cloud_name, folder } = await sigRes.json();

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', api_key);
    form.append('timestamp', timestamp);
    form.append('signature', signature);
    if (folder) form.append('folder', folder);

    const cloudUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`;
    const up = await fetch(cloudUrl, { method:'POST', body: form });
    const data = await up.json();
    if (!up.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
    return data.secure_url;
  } catch (err){
    console.error('[GM] Cloudinary error', err);
    alert('Image upload failed. See console.');
    return null;
  }
}
