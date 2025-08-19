'use strict';
/*
 main.js — Grey Market: render one full-detail card per record (no summary),
 clear the search field after query, minimal logs, image support.
 Replace your existing main.js with this file (paste-ready).
*/

console.log('[GM] main.js loaded @', new Date().toISOString());

/* ---------- Elements ---------- */
const els = {
  searchInput: document.getElementById('combinedSearchInput'),
  gmSearchBtn: document.getElementById('gmSearchBtn'),
  resultsContainer: document.getElementById('results'),
  detailDock: document.getElementById('detailDock'),
  openAddBtn: document.getElementById('openAddBtn'),
  imgModal: document.getElementById('imgModal'),
  imgModalImg: document.getElementById('imgModalImg'),
};

let greyMarketData = []; // holds last search results

/* ---------- Helpers ---------- */
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

/* ---------- Core search flow ---------- */
async function lookupCombinedGreyMarket() {
  const termEl = els.searchInput;
  const term = (termEl?.value || '').trim();
  if (!term) {
    // nothing to do
    return;
  }

  console.log('[GM] search:', term);
  // show a tiny progress note in the GM card (but no summary table)
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
    if (!Array.isArray(data)) {
      console.warn('[GM] unexpected response (not array)', data);
      greyMarketData = Array.isArray(data.results) ? data.results : [];
    } else {
      greyMarketData = data;
    }

    console.log('[GM] results:', greyMarketData.length);

    // Clear the search input for fast subsequent searches (your requested behavior)
    if (termEl) termEl.value = '';

    // Render the detailed cards (one per record) into the full-width dock
    renderGreyMarketDetailCards(greyMarketData);

  } catch (err) {
    console.error('[GM] fetch error', err);
    if (els.resultsContainer) els.resultsContainer.innerHTML = '<div class="note">Network error. See console.</div>';
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

/* ---------- Render: multiple full-detail cards ---------- */
function renderGreyMarketDetailCards(items) {
  if (!els.detailDock) {
    console.warn('[GM] detailDock not found in DOM');
    return;
  }
  // clear any previous results
  els.detailDock.innerHTML = '';

  if (!items || items.length === 0) {
    // show nothing (user asked for no summary), but we can show an empty note if desired
    // els.detailDock.innerHTML = '<div class="note">No matches.</div>';
    return;
  }

  // create one full-width card per item
  items.forEach((item, idx) => {
    try {
      const card = buildDetailCard(item, idx);
      els.detailDock.appendChild(card);
      console.log('[GM] render card idx=' + idx + ' id=' + (getFirst(item, ['Unique ID','uniqueId','_id']) || '—'));
    } catch (e) {
      console.error('[GM] render card error idx=' + idx, e);
    }
  });

  // Wire images inside the dock to modal (delegated)
  attachDetailImageHandlers();
}

/* ---------- Build a single full-detail card element ---------- */
function buildDetailCard(item, idx) {
  const card = document.createElement('div');
  card.className = 'detail-card card'; // keep consistent with your CSS

  // Grid layout: details (left) + image (right)
  // Use CSS grid via classes, but ensure layout if CSS missing fallback to flex
  card.style.display = 'grid';
  card.style.gridTemplateColumns = '1fr 340px';
  card.style.gap = '20px';
  card.style.alignItems = 'start';
  card.style.marginBottom = '18px';

  // LEFT: details (dl grid)
  const details = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'detail-title';
  const headModel = getFirst(item, ['Model','Model Name']) || 'Unknown Model';
  const headPrice = getFirst(item, ['Price','Current Retail (Not Inc Tax)','CurrentRetail']) || '';
  title.textContent = headPrice ? `${headModel} • ${fmtUSD(headPrice)}` : headModel;
  title.style.marginTop = '0';
  title.style.marginBottom = '8px';
  title.style.color = '#d4af37';

  const dl = document.createElement('dl');
  dl.className = 'detail-grid';
  dl.style.display = 'grid';
  dl.style.gridTemplateColumns = '1fr 1fr';
  dl.style.gap = '10px 20px';
  dl.style.margin = '0';

  // Preferred ordering (show these first)
  const preferred = [
    ['Unique ID', ['Unique ID','uniqueId','_id']],
    ['Date Entered', ['Date Entered','DateEntered','Date']],
    ['Model', ['Model']],
    ['Model Name', ['Model Name','ModelName']],
    ['Nickname/Dial', ['Nickname or Dial','Nickname','Dial']],
    ['Dealer', ['Dealer']],
    ['Year', ['Year']],
    ['Bracelet', ['Bracelet']],
    ['Bracelet Metal/Color', ['Bracelet Metal/Color','BraceletColor']],
    ['Metal', ['Metal']],
    ['Full Set', ['Full Set','FullSet']],
    ['Retail Ready', ['Retail Ready','RetailReady']],
    ['Current Retail (Not Inc Tax)', ['Current Retail (Not Inc Tax)','CurrentRetail','Retail']],
    ['Reference', ['reference','Reference']],
    ['Date Posted', ['Date Posted','DatePosted']],
    ['Comments', ['Comments','comments']],
  ];

  // Render preferred pairs
  for (const [label, keys] of preferred) {
    const v = getFirst(item, keys);
    addDlPair(dl, label, v);
  }

  // Render any remaining keys not already shown (to ensure we show everything)
  const shownKeys = new Set(preferred.flatMap(p => p[1]));
  for (const k of Object.keys(item || {})) {
    if (shownKeys.has(k)) continue;
    // skip internal mongo fields like __v if empty-ish
    addDlPair(dl, k, item[k]);
  }

  details.appendChild(title);
  details.appendChild(dl);

  // Bottom actions (edit button) — keep if present
  const actions = document.createElement('div');
  actions.style.marginTop = '12px';
  const editBtn = document.createElement('button');
  editBtn.textContent = 'Edit';
  editBtn.className = 'btn';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // If you have an edit flow, call existing function; otherwise no-op
    if (typeof showEditGreyMarketForm === 'function') {
      showEditGreyMarketForm(item);
    } else {
      console.log('[GM] edit requested for', getFirst(item, ['Unique ID','uniqueId','_id']));
    }
  });
  actions.appendChild(editBtn);
  details.appendChild(actions);

  // RIGHT: image container
  const imgWrap = document.createElement('div');
  imgWrap.style.display = 'flex';
  imgWrap.style.alignItems = 'start';
  imgWrap.style.justifyContent = 'center';
  imgWrap.style.minWidth = '220px';
  imgWrap.style.maxWidth = '340px';

  // image sources: try several fields
  const rawImg = getFirst(item, ['ImageFilename','ImageUrl','Image','image','ImageFilenameUrl']);
  let imgSrc = '';
  if (rawImg) {
    // if it's a full URL, use it; otherwise assume it's an asset filename
    if (/^https?:\/\//i.test(rawImg)) imgSrc = rawImg;
    else imgSrc = `assets/grey_market/${rawImg}`;
  }

  if (imgSrc) {
    const img = document.createElement('img');
    img.className = 'watch-image enlargeable-img';
    img.src = imgSrc;
    img.alt = headModel;
    img.style.maxWidth = '100%';
    img.style.border = '1px solid #d4af37';
    img.style.borderRadius = '8px';
    img.style.cursor = 'pointer';
    img.dataset.src = imgSrc; // for modal handler
    imgWrap.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.style.width = '220px';
    ph.style.height = '160px';
    ph.style.display = 'flex';
    ph.style.alignItems = 'center';
    ph.style.justifyContent = 'center';
    ph.style.background = '#0f0f0f';
    ph.style.border = '1px dashed #444';
    ph.style.borderRadius = '8px';
    ph.textContent = 'No image';
    imgWrap.appendChild(ph);
  }

  // Assemble
  card.appendChild(details);
  card.appendChild(imgWrap);

  // Accessibility
  card.setAttribute('role', 'article');
  card.setAttribute('data-idx', String(idx));

  return card;
}

function addDlPair(dl, label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  dt.style.fontWeight = '700';
  dt.style.color = '#d4af37';
  dt.style.marginBottom = '2px';
  const dd = document.createElement('dd');
  dd.textContent = (value === undefined || value === null || String(value).trim() === '') ? '—' : String(value);
  dd.style.margin = '0 0 12px 0';
  dl.appendChild(dt);
  dl.appendChild(dd);
}

/* ---------- Image modal handlers (delegated) ---------- */
function attachDetailImageHandlers() {
  if (!els.detailDock) return;
  // delegate click on images
  els.detailDock.onclick = function (e) {
    const img = e.target.closest('.enlargeable-img');
    if (!img) return;
    const src = img.dataset?.src || img.src;
    if (!src) return;
    openImageModal(src);
  };
  // ensure modal close click works
  if (els.imgModal) {
    els.imgModal.onclick = function () { els.imgModal.style.display = 'none'; };
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') els.imgModal.style.display = 'none';
    });
  }
}
function openImageModal(src) {
  if (!els.imgModal || !els.imgModalImg) return;
  els.imgModalImg.src = src;
  els.imgModal.style.display = 'flex';
}

/* ---------- Init / Event bindings ---------- */
document.addEventListener('DOMContentLoaded', () => {
  if (els.gmSearchBtn) els.gmSearchBtn.addEventListener('click', lookupCombinedGreyMarket);
  if (els.searchInput) {
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookupCombinedGreyMarket();
    });
  }
  if (els.openAddBtn) {
    els.openAddBtn.addEventListener('click', () => {
      if (typeof showAddGreyMarketForm === 'function') showAddGreyMarketForm();
    });
  }
});
