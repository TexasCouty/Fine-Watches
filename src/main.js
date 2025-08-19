'use strict';
/* Desktop-first GM list + single detail card.
   On search:
     - Renders list
     - Auto-selects first result and shows the full-width detail card below the list
   Endpoints:
     - /.netlify/functions/greyMarketLookup?term=...
     - /.netlify/functions/updateGreyMarket { uniqueId, fields }
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
  gmDetail: document.getElementById('gmDetail'),
  refDetail: document.getElementById('refDetail'), // so we can clear it when GM searches
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
    console.log('[GM] search button', v);
    searchGreyMarket(v);
  });

  els.search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      console.log('[GM] search enter', e.currentTarget.value);
      searchGreyMarket(e.currentTarget.value);
    }
  });

  els.openAddBtn?.addEventListener('click', () => { els.sheetForm?.reset(); els.sheet?.classList.add('open'); });

  els.modalClose?.addEventListener('click', closeImgModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeImgModal(); });

  els.sheetClose?.addEventListener('click', closeEditSheet);
});

/*────────────────────────────────────────────────────────────────────────────*/
// Fetch & render
async function searchGreyMarket(term = '') {
  const q = (term || '').trim();
  if (!q) {
    console.warn('[GM] empty term');
    els.results.innerHTML = '<div class="note">Enter a model, nickname, or dealer to search.</div>';
    els.count.textContent = '';
    clearGMDetail();
    return;
  }

  try {
    showSkeletons();
    // When searching GM, hide any Reference details
    if (els.refDetail) els.refDetail.innerHTML = '';

    const url = `/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(q)}`;
    console.log('[GM] GET', url);
    const r = await fetch(url);
    const text = await r.text();
    console.log('[GM] status', r.status, 'body (first 400):', text.slice(0, 400));
    if (!r.ok) {
      els.results.innerHTML = `<div class="note">Server error (${r.status}). See Functions logs.</div>`;
      els.count.textContent = '';
      clearGMDetail();
      return;
    }
    let data = null;
    try { data = JSON.parse(text); } catch (e) { console.error('[GM] parse fail', e); }
    state.rows = Array.isArray(data) ? data : (data?.results || []);
    safeSort();

    // Auto-select first result
    state.selectedGMIndex = state.rows.length ? 0 : -1;
    render();

    if (state.selectedGMIndex >= 0) {
      renderGMDetail(state.rows[state.selectedGMIndex]);
    } else {
      clearGMDetail();
    }
  } catch (err) {
    console.error('[GM] fetch error', err);
    els.results.innerHTML = `<div class="note">Network error. See console.</div>`;
    els.count.textContent = '';
    clearGMDetail();
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
function render() {
  const mobile = window.innerWidth < 768;
  els.count.textContent = `${state.rows.length} results`;
  els.results.innerHTML = '';
  if (mobile) renderCards(); else renderTable();
}

function showSkeletons() {
  const n = 6;
  els.results.innerHTML = `
    <div class="tablewrap">
      <table><thead><tr>
        <th>Model</th><th>Dealer</th><th>Price</th><th>Date</th>
      </tr></thead><tbody>
        ${Array.from({length:n}).map(()=>`
          <tr>
            <td><div class="skel" style="height:14px"></div></td>
            <td><div class="skel" style="height:14px"></div></td>
            <td><div class="skel" style="height:14px"></div></td>
            <td><div class="skel" style="height:14px"></div></td>
          </tr>
        `).join('')}
      </tbody></table>
    </div>`;
}

function renderTable() {
  const wrap = document.createElement('div'); wrap.className = 'tablewrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');

  const cols = [
    {k:'Model', label:'Model'},
    {k:'Dealer', label:'Dealer'},
    {k:'Price', label:'Price'},
    {k:'DateEntered', label:'Date'},
  ];

  cols.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label;
    th.tabIndex = 0; th.setAttribute('role','button');
    if (state.sort.key === c.k) th.setAttribute('aria-sort', state.sort.dir==='asc'?'ascending':'descending');
    th.addEventListener('click', () => toggleSort(c.k));
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(c.k); } });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  const tbody = document.createElement('tbody');
  state.rows.forEach((row, idx) => {
    const r = document.createElement('tr');
    r.setAttribute('tabindex', '0');
    r.setAttribute('role', 'button');
    if (idx === state.selectedGMIndex) r.classList.add('is-selected');
    r.innerHTML = `
      <td>${esc(row.Model)}</td>
      <td>${esc(row.Dealer)}</td>
      <td>${fmtPrice(row.Price)}</td>
      <td>${fmtDate(row.DateEntered)}</td>
    `;
    r.addEventListener('click', () => onSelectGM(idx));
    r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectGM(idx); } });
    tbody.appendChild(r);
  });

  table.append(thead, tbody); wrap.appendChild(table); els.results.appendChild(wrap);
}

function renderCards() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  state.rows.forEach((row, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    if (idx === state.selectedGMIndex) card.classList.add('is-selected');

    const title = document.createElement('h3');
    title.textContent = `${row.Model ?? '—'} • ${fmtPrice(row.Price)}`;

    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `${row.ModelName ?? ''}${row.Nickname ? ' • ' + row.Nickname : ''} • ${fmtDate(row.DateEntered)}`;

    const img = document.createElement('img');
    img.className = 'thumb';
    img.loading = 'lazy';
    if (row.ImageUrl) img.src = row.ImageUrl;
    img.alt = row.Model ?? 'Watch photo';
    img.addEventListener('click', () => openImgModal(row.ImageUrl));

    const meta = document.createElement('dl');
    meta.className = 'meta';
    addMeta(meta, 'Dealer', row.Dealer);
    addMeta(meta, 'Set', row['Full Set'] ? 'Full' : 'Partial');
    addMeta(meta, 'Retail', row['Retail Ready'] ? 'Yes' : 'No');
    addMeta(meta, 'Year', row.Year ?? '—');
    addMeta(meta, 'Metal', row.Metal ?? '—');
    addMeta(meta, 'Bracelet', row.BraceletColor ?? '—');

    const actions = document.createElement('div');
    actions.style.marginTop = '10px';
    const viewBtn = mkBtn('View Details');
    viewBtn.addEventListener('click', () => onSelectGM(idx));
    actions.appendChild(viewBtn);

    card.append(title, sub, img, meta, actions);
    grid.appendChild(card);
  });
  els.results.appendChild(grid);
}

function onSelectGM(idx){
  state.selectedGMIndex = idx;
  console.log('[GM] select', idx, state.rows[idx]);
  render();                      // refresh list highlight
  renderGMDetail(state.rows[idx]); // show detail card
}

/*────────────────────────────────────────────────────────────────────────────*/
// Full-width GM Detail Card
function renderGMDetail(row){
  if (!els.gmDetail) return;
  if (!row) { clearGMDetail(); return; }

  els.gmDetail.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'detail-card';
  section.setAttribute('role', 'region');
  section.setAttribute('aria-labelledby', 'gmDetailTitle');

  // Media
  const media = document.createElement('div');
  media.className = 'detail-media';
  if (row.ImageUrl) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = row.ImageUrl;
    img.alt = row.Model || 'Watch';
    img.addEventListener('click', () => openImgModal(row.ImageUrl));
    media.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'placeholder';
    ph.textContent = 'No image';
    media.appendChild(ph);
  }

  // Right column
  const right = document.createElement('div');
  const h3 = document.createElement('h3');
  h3.id = 'gmDetailTitle';
  h3.className = 'detail-title';
  h3.textContent = `${row.Model || '—'} • ${fmtPrice(row.Price)}`;

  const sub = document.createElement('div');
  sub.className = 'detail-sub';
  sub.textContent = fmtDate(row.DateEntered);

  const grid = document.createElement('dl');
  grid.className = 'detail-grid';
  addPair(grid, 'Model Name', row.ModelName);
  addPair(grid, 'Nickname/Dial', row.Nickname);
  addPair(grid, 'Dealer', row.Dealer);
  addPair(grid, 'Year', row.Year);
  addPair(grid, 'Metal', row.Metal);
  addPair(grid, 'Bracelet', row.BraceletColor);
  addPair(grid, 'Full Set', row['Full Set'] ? 'Yes' : 'No');
  addPair(grid, 'Retail Ready', row['Retail Ready'] ? 'Yes' : 'No');
  addPair(grid, 'Current Retail', row['Current Retail (Not Inc Tax)'] ? fmtPrice(row['Current Retail (Not Inc Tax)']) : '—');
  addPair(grid, 'Comments', row.Comments);
  addPair(grid, 'Unique ID', row['Unique ID'] || row.uniqueId);
  if (row.ImageUrl) {
    const dt = document.createElement('dt'); dt.textContent = 'Image URL';
    const dd = document.createElement('dd');
    const a = document.createElement('a'); a.href = row.ImageUrl; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open';
    dd.appendChild(a);
    grid.append(dt, dd);
  } else {
    addPair(grid, 'Image URL', '—');
  }

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const editBtn = mkBtn('Edit'); editBtn.classList.add('primary');
  editBtn.addEventListener('click', () => openEditSheet(row));
  const closeBtn = mkBtn('Close details');
  closeBtn.addEventListener('click', clearGMDetail);
  actions.append(editBtn, closeBtn);

  right.append(h3, sub, grid, actions);
  section.append(media, right);
  els.gmDetail.appendChild(section);
}

function clearGMDetail(){ if (els.gmDetail) els.gmDetail.innerHTML = ''; }

/*────────────────────────────────────────────────────────────────────────────*/
// Utilities
function toggleSort(key){
  if (state.sort.key === key) state.sort.dir = state.sort.dir==='asc'?'desc':'asc';
  else { state.sort.key = key; state.sort.dir = 'asc'; }
  safeSort(); render();
}
function addMeta(dl, k, v){ const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v ?? '—'; dl.append(dt, dd); }
function addPair(dl, k, v){ const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v ?? '—'; dl.append(dt, dd); }
function mkBtn(txt){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
function esc(s){ return (s==null? '': String(s)).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
function fmtPrice(p){ if (p==null||p==='') return '—'; const n=Number(p); if (Number.isNaN(n)) return String(p); return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
function fmtDate(d){ const dt = d? new Date(d): null; return dt? dt.toLocaleDateString(): '—'; }

/*────────────────────────────────────────────────────────────────────────────*/
// Modal + Edit sheet
function openImgModal(src){ if(!src) return; els.modalImg.src = src; els.modal.classList.add('open'); }
function closeImgModal(){ els.modal.classList.remove('open'); els.modalImg.removeAttribute('src'); }

function openEditSheet(row){
  els.sheet.classList.add('open');
  els.sheetForm.reset();

  setFormValue('Unique ID', row['Unique ID'] || row.uniqueId || row._id || '');
  setFormValue('Model', row.Model || '');
  setFormValue('Dealer', row.Dealer || '');
  setFormValue('Price', row.Price ?? '');
  setCheckbox('Full Set', !!row['Full Set']);
  setCheckbox('Retail Ready', !!row['Retail Ready']);
  setFormValue('Year', row.Year || '');
  setFormValue('Metal', row.Metal || '');
  setFormValue('BraceletColor', row.BraceletColor || '');
  setFormValue('ImageUrl', row.ImageUrl || '');
}
function closeEditSheet(){ els.sheet.classList.remove('open'); }
function setFormValue(name, val){ const el = els.sheetForm.querySelector(`[name="${name}"]`); if (el) el.value = val; }
function setCheckbox(name, checked){ const el = els.sheetForm.querySelector(`[name="${name}"]`); if (el && el.type === 'checkbox') el.checked = !!checked; }

/*────────────────────────────────────────────────────────────────────────────*/
// Save handler → updateGreyMarket expects { uniqueId, fields }
els.sheetForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.sheetForm);

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
      fields[k] = v === '' ? v : Number(v);
    } else {
      fields[k] = v;
    }
  }

  const payload = { uniqueId, fields };
  console.log('[GM] Update payload', payload);

  try {
    const r = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    console.log('[GM] update status', r.status, 'body', text.slice(0, 400));
    if (!r.ok) { alert(`Save failed (${r.status}). See console.`); return; }
    closeEditSheet();
    searchGreyMarket(els.search?.value || '');
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
    console.log('[GM] Cloudinary uploaded', data.secure_url);
    return data.secure_url;
  } catch (err){
    console.error('[GM] Cloudinary error', err);
    alert('Image upload failed. See console.');
    return null;
  }
}
