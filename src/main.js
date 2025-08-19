/* Main UI controller – mobile-first cards + desktop table
   - One button: "Grey Market Lookup"
   - Correct endpoints:
       greyMarketLookup?term=...
       updateGreyMarket expects { uniqueId, fields }
   - Signed Cloudinary uploads via getCloudinarySignature
   - Verbose console logs for easier debugging
*/

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
  sheetOpenForId: null,
};

let state = {
  rows: [],
  sort: { key: 'DateEntered', dir: 'desc' },
};

/*────────────────────────────────────────────────────────────────────────────*/
// Event bindings
document.addEventListener('DOMContentLoaded', () => {
  // Search button
  els.gmBtn?.addEventListener('click', () => {
    const v = els.search?.value || '';
    searchGreyMarket(v);
  });

  // Enter to search
  els.search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchGreyMarket(e.currentTarget.value);
  });

  // Add new entry (open empty form)
  els.openAddBtn?.addEventListener('click', () => {
    if (!els.sheet || !els.sheetForm) return;
    els.sheetForm.reset();
    els.sheet.classList.add('open');
  });

  // Modal
  els.modalClose?.addEventListener('click', closeImgModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && els.modal?.classList.contains('open')) closeImgModal();
  });

  // Sheet close
  els.sheetClose?.addEventListener('click', closeEditSheet);
});

/*────────────────────────────────────────────────────────────────────────────*/
// Fetch GM data
async function searchGreyMarket(term = '') {
  const q = (term || '').trim();
  if (!q) {
    console.warn('[GM] Skipping search: empty term');
    if (els.results) els.results.innerHTML = '<div class="note">Enter a model, nickname, or dealer to search.</div>';
    if (els.count) els.count.textContent = '';
    return;
  }

  try {
    showSkeletons();
    const url = `/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(q)}`;
    console.log('[GM] GET', url);
    const r = await fetch(url);
    const text = await r.text();
    console.log('[GM] status', r.status, 'body', text.slice(0, 500));
    if (!r.ok) {
      els.results.innerHTML = `<div class="note">Server error (${r.status}). Check Netlify Functions logs.</div>`;
      if (els.count) els.count.textContent = '';
      return;
    }
    const data = safeJson(text);
    state.rows = Array.isArray(data) ? data : (data?.results || []);
    console.log('[GM] rows', state.rows.length);
    safeSort();
    render();
  } catch (err) {
    console.error('[GM] Fetch error', err);
    els.results.innerHTML = `<div class="note">Network error. See console for details.</div>`;
    if (els.count) els.count.textContent = '';
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function safeSort() {
  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  state.rows.sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (!isNaN(+av) && !isNaN(+bv)) return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  });
}

/*────────────────────────────────────────────────────────────────────────────*/
// Rendering
function render() {
  const mobile = window.innerWidth < 768;
  if (els.count) els.count.textContent = `${state.rows.length} results`;
  els.results.innerHTML = '';
  if (mobile) renderCards(); else renderTable();
}

function showSkeletons() {
  const mobile = window.innerWidth < 768;
  const n = 6;
  if (mobile) {
    els.results.innerHTML = '<div class="grid">' + Array.from({length:n}).map(()=>`
      <div class="card">
        <div class="skel" style="width:60%;height:18px;margin-bottom:10px"></div>
        <div class="skel" style="width:40%;height:12px;margin-bottom:12px"></div>
        <div class="skel" style="width:100%;height:180px"></div>
      </div>
    `).join('') + '</div>';
  } else {
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
}

function renderCards() {
  const grid = document.createElement('div');
  grid.className = 'grid';
  state.rows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'card';

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
    const editBtn = mkBtn('Edit');
    editBtn.addEventListener('click', () => openEditSheet(row));
    actions.appendChild(editBtn);

    card.append(title, sub, img, meta, actions);
    grid.appendChild(card);
  });
  els.results.appendChild(grid);
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
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(c.k); }
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  const tbody = document.createElement('tbody');
  state.rows.forEach(row => {
    const r = document.createElement('tr');
    r.innerHTML = `
      <td>${esc(row.Model)}</td>
      <td>${esc(row.Dealer)}</td>
      <td>${fmtPrice(row.Price)}</td>
      <td>${fmtDate(row.DateEntered)}</td>
    `;
    r.addEventListener('click', () => openEditSheet(row));
    tbody.appendChild(r);
  });

  table.append(thead, tbody); wrap.appendChild(table); els.results.appendChild(wrap);
}

function toggleSort(key){
  if (state.sort.key === key) state.sort.dir = state.sort.dir==='asc'?'desc':'asc';
  else { state.sort.key = key; state.sort.dir = 'asc'; }
  safeSort(); render();
}

function addMeta(dl, k, v){ const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v ?? '—'; dl.append(dt, dd); }
function mkBtn(txt){ const b=document.createElement('button'); b.className='btn'; b.textContent=txt; return b; }
function esc(s){ return (s==null? '': String(s)).replace(/[&<>]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
function fmtPrice(p){ if (p==null||p==='') return '—'; const n=Number(p); if (Number.isNaN(n)) return String(p); return n.toLocaleString(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}); }
function fmtDate(d){ const dt = d? new Date(d): null; return dt? dt.toLocaleDateString(): '—'; }

/*────────────────────────────────────────────────────────────────────────────*/
// Image modal
function openImgModal(src){ if(!src) return; els.modalImg.src = src; els.modal.classList.add('open'); }
function closeImgModal(){ els.modal.classList.remove('open'); els.modalImg.removeAttribute('src'); }

/*────────────────────────────────────────────────────────────────────────────*/
// Edit sheet open/close
function openEditSheet(row){
  els.sheet.classList.add('open');
  els.sheetForm.reset();

  // Populate fields by matching names
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

function setFormValue(name, val){
  const el = els.sheetForm.querySelector(`[name="${name}"]`);
  if (el) el.value = val;
}
function setCheckbox(name, checked){
  const el = els.sheetForm.querySelector(`[name="${name}"]`);
  if (el && el.type === 'checkbox') el.checked = !!checked;
}

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
    console.log('[GM] update status', r.status, 'body', text);
    if (!r.ok) { alert(`Save failed (${r.status}). See console.`); return; }
    closeEditSheet();
    searchGreyMarket(els.search?.value || '');
  } catch (err) {
    console.error('[GM] update error', err);
    alert('Save failed. See console.');
  }
});

/*────────────────────────────────────────────────────────────────────────────*/
// Signed Cloudinary upload helper
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
