'use strict';
/*
  src/main.js (stable)
  - Grey Market: one full-detail card per record, rendered in #detailDock
  - Clears the search input after a search
  - Restores original label order/format for details
  - Conservative JS (no optional chaining) to avoid syntax surprises
*/

console.log('[GM] main.js loaded @', new Date().toISOString());

/* -------------------- Element refs -------------------- */
var els = {
  searchInput: document.getElementById('combinedSearchInput'),
  gmSearchBtn: document.getElementById('gmSearchBtn'),
  resultsContainer: document.getElementById('results'),
  detailDock: document.getElementById('detailDock'),
  openAddBtn: document.getElementById('openAddBtn'),
  // Form (if present)
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
  imgModalImg: document.getElementById('imgModalImg')
};

/* -------------------- State -------------------- */
var greyMarketData = [];
var currentEditingGMModel = null;

/* -------------------- Utilities -------------------- */
function getFirst(obj, keys) {
  var i, k, v;
  if (!obj) return '';
  for (i = 0; i < keys.length; i++) {
    k = keys[i];
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      v = obj[k];
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
  var n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function toDateInputValue(dateString) {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  var d = new Date(dateString);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

/* -------------------- Form helpers (unchanged behavior) -------------------- */
function clearGreyMarketForm() {
  if (!els.gmFormContainer) return;
  var ids = [
    'gm_unique_id','gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname',
    'gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready',
    'gm_current_retail','gm_dealer','gm_comments'
  ];
  ids.forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (els.gmCurrentImg) { els.gmCurrentImg.src = ''; els.gmCurrentImg.style.display = 'none'; }
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'none';
  currentEditingGMModel = null;
  els.gmFormContainer.style.display = 'none';
}
function showAddGreyMarketForm() {
  if (!els.gmFormContainer) return;
  clearGreyMarketForm();
  var ttl = document.getElementById('greyMarketFormTitle');
  if (ttl) ttl.innerText = 'Add New Grey Market Entry';
  els.gmFormContainer.style.display = 'block';
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'none';
}
function showEditGreyMarketForm(record) {
  if (!els.gmFormContainer || !record) return;
  var ttl = document.getElementById('greyMarketFormTitle');
  if (ttl) ttl.innerText = 'Edit Grey Market Entry';
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

  var imgRaw = getFirst(record, ['ImageFilename','ImageUrl','Image','image']);
  if (imgRaw && els.gmCurrentImg) {
    var src = /^https?:\/\//i.test(imgRaw) ? imgRaw : ('assets/grey_market/' + imgRaw);
    els.gmCurrentImg.src = src;
    els.gmCurrentImg.style.display = 'block';
  } else if (els.gmCurrentImg) {
    els.gmCurrentImg.src = '';
    els.gmCurrentImg.style.display = 'none';
  }

  currentEditingGMModel = getFirst(record,['Model']) || '';
  if (els.gmDeleteBtn) els.gmDeleteBtn.style.display = 'inline-block';
}
function cancelGreyMarketForm() { clearGreyMarketForm(); }

/* -------------------- Save handler (keeps your unsigned Cloudinary path) -------------------- */
async function saveGreyMarketEntry() {
  if (!els.gmFormContainer) return;

  var Model = (els.gmModel && els.gmModel.value ? els.gmModel.value : '').trim();
  var fields = {
    'Unique ID': (els.gmUniqueId && els.gmUniqueId.value ? els.gmUniqueId.value : '').trim(),
    'Date Entered': (els.gmDateEntered && els.gmDateEntered.value ? els.gmDateEntered.value : '').trim(),
    Year: (els.gmYear && els.gmYear.value ? els.gmYear.value : '').trim(),
    Model: Model,
    'Model Name': (els.gmModelName && els.gmModelName.value ? els.gmModelName.value : '').trim(),
    'Nickname or Dial': (els.gmNickname && els.gmNickname.value ? els.gmNickname.value : '').trim(),
    Bracelet: (els.gmBracelet && els.gmBracelet.value ? els.gmBracelet.value : '').trim(),
    'Bracelet Metal/Color': (els.gmBraceletColor && els.gmBraceletColor.value ? els.gmBraceletColor.value : '').trim(),
    Price: (els.gmPrice && els.gmPrice.value ? els.gmPrice.value : '').trim(),
    'Full Set': (els.gmFullSet && els.gmFullSet.value ? els.gmFullSet.value : '').trim(),
    'Retail Ready': (els.gmRetailReady && els.gmRetailReady.value ? els.gmRetailReady.value : '').trim(),
    'Current Retail (Not Inc Tax)': (els.gmCurrentRetail && els.gmCurrentRetail.value ? els.gmCurrentRetail.value : '').trim(),
    Dealer: (els.gmDealer && els.gmDealer.value ? els.gmDealer.value : '').trim(),
    Comments: (els.gmComments && els.gmComments.value ? els.gmComments.value : '').trim()
  };

  // Image upload (unsigned)
  var imageUrl = '';
  var fileInput = els.gmImageInput;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      var data = new FormData();
      data.append('file', fileInput.files[0]);
      data.append('upload_preset', 'unsigned_preset');
      var cloudName = 'dnymcygtl';
      var up = await fetch('https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload', { method: 'POST', body: data });
      var upj = await up.json();
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

  var uniqueId = fields['Unique ID'] || '';
  if (!Model) {
    alert('Model is required.');
    return;
  }

  var payload = { uniqueId: uniqueId, fields: fields };
  console.log('[GM] Save payload', payload);

  try {
    var r = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var text = await r.text();
    if (!r.ok) {
      console.error('[GM] save error', r.status, text);
      alert('Save failed. See console.');
      return;
    }
    alert('Saved.');
    clearGreyMarketForm();
    // (Optional) re-run current search if the box is empty (user flows)
    if (els.gmSearchBtn) {
      // no-op unless you want to trigger a refresh
    }
  } catch (err) {
    console.error('[GM] save exception', err);
    alert('Save failed. See console.');
  }
}

/* -------------------- Core search flow -------------------- */
async function lookupCombinedGreyMarket() {
  var termEl = els.searchInput;
  var term = (termEl && termEl.value ? termEl.value : '').trim();
  if (!term) return;

  console.log('[GM] search:', term);
  if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Searching…</div>';

  try {
    var url = '/.netlify/functions/greyMarketLookup?term=' + encodeURIComponent(term);
    console.log('[GM] fetch', url);
    var r = await fetch(url);
    if (!r.ok) {
      console.error('[GM] server error', r.status);
      if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Server error (' + r.status + ').</div>';
      return;
    }
    var data = await r.json();
    if (Array.isArray(data)) greyMarketData = data;
    else if (data && Array.isArray(data.results)) greyMarketData = data.results;
    else greyMarketData = [];

console.log('[GM] results:', greyMarketData.length);

// Clear the "Searching…" note now that we have results
if (els.resultsContainer) els.resultsContainer.innerHTML = '';

// Clear search input after successful search
if (termEl) termEl.value = '';

// Render full detail cards (one per record) into #detailDock
renderGreyMarketDetailCards(greyMarketData);

  } catch (err) {
    console.error('[GM] fetch error', err);
    if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

/* -------------------- Render multiple detail cards -------------------- */
function renderGreyMarketDetailCards(items) {
  if (!els.detailDock) {
    console.warn('[GM] detailDock not found');
    return;
  }
  els.detailDock.innerHTML = '';

if (!items || items.length === 0) {
  if (els.resultsContainer) els.resultsContainer.innerHTML = '';
  els.detailDock.innerHTML =
    '<div class="note empty">No matches found.<br><small>Try a different model, nickname, dealer, or reference.</small></div>';
  return;
}

  items.forEach(function(item, idx) {
    try {
      var card = buildDetailCard(item, idx);
      els.detailDock.appendChild(card);
      var idlog = getFirst(item, ['Unique ID','uniqueId','_id']) || '—';
      console.log('[GM] render card idx=' + idx + ' id=' + idlog);
    } catch (e) {
      console.error('[GM] render card error idx=' + idx, e);
    }
  });

  // wire modal handler once (delegated)
  attachDetailImageHandlers();
}

/* -------------------- Build one detail card (original labels/order) -------------------- */
function buildDetailCard(item, idx) {
  var card = document.createElement('div');
  card.className = 'card detail-card';
  card.style.display = 'flex';
  card.style.gap = '20px';
  card.style.padding = '15px';
  card.style.marginBottom = '20px';
  card.style.border = '1px solid #d4af37';
  card.style.borderRadius = '10px';
  card.style.alignItems = 'flex-start';

  // IMAGE (left)
  var rawImg = getFirst(item, ['ImageFilename','ImageUrl','Image','image']);
  var imgSrc = '';
  if (rawImg) {
    imgSrc = /^https?:\/\//i.test(rawImg) ? rawImg : ('assets/grey_market/' + rawImg);
  }
  var imgHtml = '';
  if (imgSrc) {
    imgHtml =
      '<img src="' + escapeHtml(imgSrc) + '" ' +
      'class="enlargeable-img" ' +
      'style="max-width:200px;margin-right:20px;border-radius:8px;cursor:pointer;" ' +
      'onerror="this.style.display=\'none\';" ' +
      'data-src="' + escapeHtml(imgSrc) + '" />';
  }

  // DETAILS (exact order/labels you had)
  var uniqueId = escapeHtml(getFirst(item,['Unique ID','uniqueId','_id']) || '');
  var model = escapeHtml(getFirst(item,['Model']) || '');
  var dateEntered = escapeHtml(getFirst(item,['Date Entered','DateEntered']) || '');
  var year = escapeHtml(getFirst(item,['Year']) || '');
  var modelName = escapeHtml(getFirst(item,['Model Name','ModelName']) || '');
  var nickname = escapeHtml(getFirst(item,['Nickname or Dial','Nickname','Dial']) || '');
  var bracelet = escapeHtml(getFirst(item,['Bracelet']) || '');
  var braceletColor = escapeHtml(getFirst(item,['Bracelet Metal/Color','BraceletColor']) || '');
  var fullSet = escapeHtml(getFirst(item,['Full Set','FullSet']) || '');
  var retailReady = escapeHtml(getFirst(item,['Retail Ready','RetailReady']) || '');
  var price = escapeHtml(getFirst(item,['Price']) || '');
  var currentRetail = escapeHtml(getFirst(item,['Current Retail (Not Inc Tax)','CurrentRetail','Retail']) || '');
  var dealer = escapeHtml(getFirst(item,['Dealer']) || '');
  var comments = escapeHtml(getFirst(item,['Comments','comments']) || '');

  var detailsHtml =
    '<div style="flex:1 1 auto;">' +
      '<p><strong>Unique ID:</strong> ' + uniqueId + '</p>' +
      '<p><strong>Model:</strong> ' + model + '</p>' +
      '<p><strong>Date Entered:</strong> ' + dateEntered + '</p>' +
      '<p><strong>Year:</strong> ' + year + '</p>' +
      '<p><strong>Model Name:</strong> ' + modelName + '</p>' +
      '<p><strong>Nickname/Dial:</strong> ' + nickname + '</p>' +
      '<p><strong>Bracelet:</strong> ' + bracelet + '</p>' +
      '<p><strong>Bracelet Metal/Color:</strong> ' + braceletColor + '</p>' +
      '<p><strong>Full Set:</strong> ' + fullSet + '</p>' +
      '<p><strong>Retail Ready:</strong> ' + retailReady + '</p>' +
      '<p><strong>Grey Market Price:</strong> ' + price + '</p>' +
      '<p><strong>Current Retail:</strong> ' + currentRetail + '</p>' +
      '<p><strong>Dealer:</strong> ' + dealer + '</p>' +
      '<p><strong>Comments:</strong> ' + comments + '</p>' +
      '<div style="margin-top:12px;"><button class="btn btn-edit">Edit</button></div>' +
    '</div>';

  card.innerHTML = imgHtml + detailsHtml;
  card.setAttribute('data-idx', String(idx));

  var editBtn = card.querySelector('.btn-edit');
  if (editBtn) {
    editBtn.addEventListener('click', function(e){
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

/* -------------------- Image modal (delegated) -------------------- */
function attachDetailImageHandlers() {
  if (!els.detailDock) return;

  // overwrite previous to avoid stacking
  els.detailDock.onclick = function(e) {
    var img = e.target && e.target.closest ? e.target.closest('.enlargeable-img') : null;
    if (!img) return;
    var src = (img.dataset && img.dataset.src) ? img.dataset.src : img.src;
    if (!src) return;
    openImageModal(src);
  };

  if (els.imgModal) {
    els.imgModal.onclick = function() { els.imgModal.style.display = 'none'; };
    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') els.imgModal.style.display = 'none';
    });
  }
}
function openImageModal(src) {
  if (!els.imgModal || !els.imgModalImg) return;
  els.imgModalImg.src = src;
  els.imgModal.style.display = 'flex';
}

/* -------------------- Bindings -------------------- */
document.addEventListener('DOMContentLoaded', function(){
  if (els.gmSearchBtn) els.gmSearchBtn.addEventListener('click', lookupCombinedGreyMarket);
  if (els.searchInput) {
    els.searchInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') lookupCombinedGreyMarket();
    });
  }
  if (els.openAddBtn) {
    els.openAddBtn.addEventListener('click', function(){
      if (typeof showAddGreyMarketForm === 'function') showAddGreyMarketForm();
    });
  }
  if (els.saveGmBtn) els.saveGmBtn.addEventListener('click', function(e){ e.preventDefault(); saveGreyMarketEntry(); });
  if (els.cancelGmBtn) els.cancelGmBtn.addEventListener('click', function(e){ e.preventDefault(); cancelGreyMarketForm(); });
  if (els.gmDeleteBtn) els.gmDeleteBtn.addEventListener('click', function(e){ e.preventDefault(); console.log('[GM] delete requested'); });
});
