'use strict';
/*
  src/main.js
  - Grey Market: render one full-detail card per record under #detailDock
  - Clears search input after a search
  - Restores previous label order/format for details
  - Lightweight logging with [GM] prefix
*/

console.log('[GM] main.js loaded @', new Date().toISOString());

/* -------------------- Element refs -------------------- */
const els = {
  searchInput: document.getElementById('combinedSearchInput'),
  gmSearchBtn: document.getElementById('gmSearchBtn'),
  resultsContainer: document.getElementById('results'),
  detailDock: document.getElementById('detailDock'),
  openAddBtn: document.getElementById('openAddBtn'),
  // Form elements (if present)
  gmFormContainer: document.getElementById('greyMarketFormContainer'),
  gmUniqueId: document.getElementById('gm_unique_id'),
  gmDateEntered: document.getElementById('gm_date_entered'),
  gmYear: document.getElementById('gm_year'),
  gmModel: document.getElementById('gm_model'),
  gmModelName: document.getElementById('gm_model_name'),
  gmNickname: document.getElementById('gm_nickname'),
  gmBracelet: document.getElementById('gm_bracelet'),
  gmBraceletColor: document.getElementById('gm_bracelet_metal_color'),
  gmPrice: document.getElementById('gm_price'),
  gmFullSet: document.getElementById('gm_full_set'),
  gmRetailReady: document.getElementById('gm_retail_ready'),
  gmCurrentRetail: document.getElementById('gm_current_retail'),
  gmDealer: document.getElementById('gm_dealer'),
  gmImageInput: document.getElementById('gm_image'),
  gmCurrentImg: document.getElementById('gm_current_img'),
  gmComments: document.getElementById('gm_comments'),
  saveGmBtn: document.getElementById('saveGmBtn'),
  cancelGmBtn: document.getElementById('cancelGmBtn'),
  gmDeleteBtn: document.getElementById('gm_delete_button'),
  imgModal: document.getElementById('imgModal'),
  imgModalImg: document.getElementById('imgModalImg'),
};

/* -------------------- State -------------------- */
let greyMarketData = []; // last set returned
let currentEditingGMModel = null;

/* -------------------- Utility helpers -------------------- */
function getFirst(obj, keys) {
  for (const k of keys) {
    if (!obj) continue;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const v = obj[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
  }
  return '';
}
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function fmtUSD(v) {
  if (v === undefined || v === null || v === '') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function toDateInputValue(dateString) {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = new Date(dateString);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

/* -------------------- Form helpers (unchanged behavior) -------------------- */
function clearGreyMarketForm() {
  if (!els.gmFormContainer) return;
  const ids = [
    'gm_unique_id','gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname',
    'gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready',
    'gm_current_retail','gm_dealer','gm_comments'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (els.gmCurrentImg) { els.gmCurrentImg.src = ''; els.gmCurrentImg.style.display = 'none'; }
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'none';
  currentEditingGMModel = null;
  if (els.gmFormContainer) els.gmFormContainer.style.display = 'none';
}
function showAddGreyMarketForm() {
  if (!els.gmFormContainer) return;
  clearGreyMarketForm();
  document.getElementById('greyMarketFormTitle')?.innerText = 'Add New Grey Market Entry';
  els.gmFormContainer.style.display = 'block';
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'none';
}
function showEditGreyMarketForm(record) {
  if (!els.gmFormContainer || !record) return;
  document.getElementById('greyMarketFormTitle')?.innerText = 'Edit Grey Market Entry';
  els.gmFormContainer.style.display = 'block';
  if (els.gmUniqueId) els.gmUniqueId.value = getFirst(record, ['Unique ID','uniqueId','_id']) || '';
  if (els.gmDateEntered) els.gmDateEntered.value = toDateInputValue(getFirst(record,['Date Entered','DateEntered'])||'');
  if (els.gmYear) els.gmYear.value = getFirst(record,['Year']) || '';
  if (els.gmModel) els.gmModel.value = getFirst(record,['Model']) || '';
  if (els.gmModelName) els.gmModelName.value = getFirst(record,['Model Name','ModelName']) || '';
  if (els.gmNickname) els.gmNickname.value = getFirst(record,['Nickname or Dial','Nickname','Dial']) || '';
  if (els.gmBracelet) els.gmBracelet.value = getFirst(record,['Bracelet']) || '';
  if (els.gmBraceletColor) els.gmBraceletColor.value = getFirst(record,['Bracelet Metal/Color','BraceletColor']) || '';
  if (els.gmPrice) els.gmPrice.value = getFirst(record,['Price']) || '';
  if (els.gmFullSet) els.gmFullSet.value = getFirst(record,['Full Set','FullSet']) || '';
  if (els.gmRetailReady) els.gmRetailReady.value = getFirst(record,['Retail Ready','RetailReady']) || '';
  if (els.gmCurrentRetail) els.gmCurrentRetail.value = getFirst(record,['Current Retail (Not Inc Tax)','CurrentRetail','Retail']) || '';
  if (els.gmDealer) els.gmDealer.value = getFirst(record,['Dealer']) || '';
  if (els.gmComments) els.gmComments.value = getFirst(record,['Comments','comments']) || '';
  const imgEl = els.gmCurrentImg;
  const imgRaw = getFirst(record, ['ImageFilename','ImageUrl','Image','image']);
  if (imgRaw) {
    const src = /^https?:\/\//i.test(imgRaw) ? imgRaw : `assets/grey_market/${imgRaw}`;
    if (imgEl) { imgEl.src = src; imgEl.style.display = 'block'; }
  } else {
    if (imgEl) { imgEl.src=''; imgEl.style.display = 'none'; }
  }
  currentEditingGMModel = getFirst(record,['Model']) || '';
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'inline-block';
}
function cancelGreyMarketForm() { clearGreyMarketForm(); }

/* -------------------- Save handler (keeps Cloudinary unsigned path like your restore) -------------------- */
async function saveGreyMarketEntry() {
  if (!els.gmFormContainer) return;
  const Model = (els.gmModel?.value || '').trim();
  const fields = {
    'Unique ID': (els.gmUniqueId?.value || '').trim(),
    'Date Entered': (els.gmDateEntered?.value || '').trim(),
    Year: (els.gmYear?.value || '').trim(),
    Model,
    'Model Name': (els.gmModelName?.value || '').trim(),
    'Nickname or Dial': (els.gmNickname?.value || '').trim(),
    Bracelet: (els.gmBracelet?.value || '').trim(),
    'Bracelet Metal/Color': (els.gmBraceletColor?.value || '').trim(),
    Price: (els.gmPrice?.value || '').trim(),
    'Full Set': (els.gmFullSet?.value || '').trim(),
    'Retail Ready': (els.gmRetailReady?.value || '').trim(),
    'Current Retail (Not Inc Tax)': (els.gmCurrentRetail?.value || '').trim(),
    Dealer: (els.gmDealer?.value || '').trim(),
    Comments: (els.gmComments?.value || '').trim(),
  };

  // Handle optional unsigned Cloudinary upload if file selected
  let imageUrl = '';
  const fileInput = els.gmImageInput;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const data = new FormData();
      data.append('file', fileInput.files[0]);
      data.append('upload_preset', 'unsigned_preset'); // ensure your unsigned preset exists
      const cloudName = 'dnymcygtl';
      const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: data });
      const upj = await up.json();
      imageUrl = upj.secure_url || '';
      if (imageUrl) fields.ImageFilename = imageUrl;
    } catch (e) {
      console.error('[GM] image upload failed', e);
      alert('Image upload failed; saving without image.');
    }
  } else if (els.gmCurrentImg && els.gmCurrentImg.src) {
    imageUrl = els.gmCurrentImg.src;
    fields.ImageFilename = imageUrl;
  }

  const uniqueId = fields['Unique ID'] || '';
  if (!Model) {
    alert('Model is required.');
    return;
  }

  const payload = { uniqueId, fields };
  console.log('[GM] Save payload', payload);

  try {
    const r = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await r.text();
    if (!r.ok) {
      console.error('[GM] save error', r.status, text);
      alert('Save failed. See console.');
      return;
    }
    alert('Saved.');
    clearGreyMarketForm();
    // refresh current search results if any term present
    if (els.searchInput && els.searchInput.value.trim() === '') {
      // if search cleared, attempt re-run last query by clicking search button if appropriate
      els.gmSearchBtn?.click();
    } else {
      // do nothing: user likely expects to continue
    }
  } catch (err) {
    console.error('[GM] save exception', err);
    alert('Save failed. See console.');
  }
}

/* -------------------- Core search flow (single-card-per-record) -------------------- */
async function lookupCombinedGreyMarket() {
  const termEl = els.searchInput;
  const term = (termEl?.value || '').trim();
  if (!term) return;

  console.log('[GM] search:', term);
  if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Searching…</div>';

  try {
    const url = `/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(term)}`;
    console.log('[GM] fetch', url);
    const r = await fetch(url);
    if (!r.ok) {
      console.error('[GM] server error', r.status);
      if (els.resultsContainer) els.resultsContainer.innerHTML = `<div class="note">Server error (${r.status}).</div>`;
      return;
    }
    const data = await r.json();
    greyMarketData = Array.isArray(data) ? data : (data && data.results ? data.results : []);
    console.log('[GM] results:', greyMarketData.length);

    // Clear search input after successful search (your requested behavior)
    if (termEl) termEl.value = '';

    // Render full detail cards (one per record) into #detailDock
    renderGreyMarketDetailCards(greyMarketData);

  } catch (err) {
    console.error('[GM] fetch error', err);
    if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

/* -------------------- Render multiple full-detail cards -------------------- */
function renderGreyMarketDetailCards(items) {
  if (!els.detailDock) {
    console.warn('[GM] detailDock not found');
    return;
  }
  // clear previous
  els.detailDock.innerHTML = '';

  if (!items || items.length === 0) {
    // intentionally show no summary; optionally show a note
    // els.detailDock.innerHTML = '<div class="note">No matches found.</div>';
    return;
  }

  items.forEach((item, idx) => {
    try {
      const card = buildDetailCard(item, idx);
      els.detailDock.appendChild(card);
      console.log('[GM] render card idx=' + idx + ' id=' + (getFirst(item,['Unique ID','uniqueId','_id']) || '—'));
    } catch (e) {
      console.error('[GM] render card error idx=' + idx, e);
    }
  });

  // attach modal handler for images (delegated)
  attachDetailImageHandlers();
}

/* -------------------- The restored buildDetailCard (original labels/order) -------------------- */
function buildDetailCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'card detail-card';
  // basic visual inline styles ensure layout even if CSS didn't load
  card.style.display = 'flex';
  card.style.gap = '20px';
  card.style.padding = '15px';
  card.style.marginBottom = '20px';
  card.style.border = '1px solid #d4af37';
  card.style.borderRadius = '10px';
  card.style.alignItems = 'flex-start';

  // IMAGE (left)
  const rawImg = getFirst(item, ['ImageFilename','ImageUrl','Image','image']);
  let imgSrc = '';
  if (rawImg) {
    imgSrc = /^https?:\/\//i.test(rawImg) ? rawImg : `assets/grey_market/${rawImg}`;
  }
  const imgHtml = imgSrc
    ? `<img src="${escapeHtml(imgSrc)}" class="enlargeable-img" style="max-width:200px;margin-right:20px;border-radius:8px;cursor:pointer;" onerror="this.style.display='none';" data-src="${escapeHtml(imgSrc)}" />`
    : '';

  // DETAILS (paragraphs with strong labels - exact order)
  const uniqueId = escapeHtml(getFirst(item,['Unique ID','uniqueId','_id']) || '');
  const model = escapeHtml(getFirst(item,['Model']) || '');
  const dateEntered = escapeHtml(getFirst(item,['Date Entered','DateEntered']) || '');
  const year = escapeHtml(getFirst(item,['Year']) || '');
  const modelName = escapeHtml(getFirst(item,['Model Name','ModelName']) || '');
  const nickname = escapeHtml(getFirst(item,['Nickname or Dial','Nickname','Dial']) || '');
  const bracelet = escapeHtml(getFirst(item,['Bracelet']) || '');
  const braceletColor = escapeHtml(getFirst(item,['Bracelet Metal/Color','BraceletColor']) || '');
  const fullSet = escapeHtml(getFirst(item,['Full Set','FullSet']) || '');
  const retailReady = escapeHtml(getFirst(item,['Retail Ready','RetailReady']) || '');
  const price = escapeHtml(getFirst(item,['Price']) || '');
  const currentRetail = escapeHtml(getFirst(item,['Current Retail (Not Inc Tax)','CurrentRetail','Retail']) || '');
  const dealer = escapeHtml(getFirst(item,['Dealer']) || '');
  const comments = escapeHtml(getFirst(item,['Comments','comments']) || '');

  const detailsHtml = `
    <div style="flex:1 1 auto;">
      <p><strong>Unique ID:</strong> ${uniqueId}</p>
      <p><strong>Model:</strong> ${model}</p>
      <p><strong>Date Entered:</strong> ${dateEntered}</p>
      <p><strong>Year:</strong> ${year}</p>
      <p><strong>Model Name:</strong> ${modelName}</p>
      <p><strong>Nickname/Dial:</strong> ${nickname}</p>
      <p><strong>Bracelet:</strong> ${bracelet}</p>
      <p><strong>Bracelet Metal/Color:</strong> ${braceletColor}</p>
      <p><strong>Full Set:</strong> ${fullSet}</p>
      <p><strong>Retail Ready:</strong> ${retailReady}</p>
      <p><strong>Grey Market Price:</strong> ${price}</p>
      <p><strong>Current Retail:</strong> ${currentRetail}</p>
      <p><strong>Dealer:</strong> ${dealer}</p>
      <p><strong>Comments:</strong> ${comments}</p>
      <div style="margin-top:12px;">
        <button class="btn btn-edit">Edit</button>
      </div>
    </div>
  `;

  card.innerHTML = imgHtml + detailsHtml;
  card.setAttribute('data-idx', String(idx));

  // attach edit handler safely
  const editBtn = card.querySelector('.btn-edit');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof showEditGreyMarketForm === 'function') {
        showEditGreyMarketForm(item);
      } else {
        console.log('[GM] edit requested for', uniqueId);
      }
    });
  }

  return card;
}

/* -------------------- Image modal handlers (delegated) -------------------- */
function attachDetailImageHandlers() {
  if (!els.detailDock) return;
  // replace previous delegate (avoid stacking)
  els.detailDock.onclick = function(e) {
    const img = e.target.closest('.enlargeable-img');
    if (!img) return;
    const src = img.dataset?.src || img.src;
    if (!src) return;
    openImageModal(src);
  };
  // modal close
  if (els.imgModal) {
    els.imgModal.onclick = function() { els.imgModal.style.display = 'none'; };
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') els.imgModal.style.display = 'none'; });
  }
}
function openImageModal(src) {
  if (!els.imgModal || !els.imgModalImg) return;
  els.imgModalImg.src = src;
  els.imgModal.style.display = 'flex';
}

/* -------------------- Initial bindings -------------------- */
document.addEventListener('DOMContentLoaded', () => {
  if (els.gmSearchBtn) els.gmSearchBtn.addEventListener('click', lookupCombinedGreyMarket);
  if (els.searchInput) {
    els.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') lookupCombinedGreyMarket(); });
  }
  if (els.openAddBtn) els.openAddBtn.addEventListener('click', () => { if (typeof showAddGreyMarketForm === 'function') showAddGreyMarketForm(); });
  if (els.saveGmBtn) els.saveGmBtn.addEventListener('click', (e) => { e.preventDefault(); saveGreyMarketEntry(); });
  if (els.cancelGmBtn) els.cancelGmBtn.addEventListener('click', (e) => { e.preventDefault(); cancelGreyMarketForm(); });
  // optional delete handler (if you implement server delete)
  if (els.gmDeleteBtn) els.gmDeleteBtn.addEventListener('click', (e) => { e.preventDefault(); console.log('[GM] delete requested'); /* implement if desired */ });

  // close modal on Escape globally
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && els.imgModal) els.imgModal.style.display = 'none'; });

  // Prefetch dataset lightly (non-blocking) — optional
  // fetchGreyMarketData(); // uncomment if you want to pre-populate suggestions
});

/* -------------------- Optional: prefetch helper (not required) -------------------- */
async function fetchGreyMarketData() {
  try {
    const res = await fetch('/.netlify/functions/greyMarketLookup?term=');
    if (!res.ok) throw new Error('prefetch failed');
    const arr = await res.json();
    // array of records; not used directly here unless you want suggestions
    // greyMarketData = arr;
  } catch (e) {
    console.warn('[GM] prefetch failed', e);
  }
}
