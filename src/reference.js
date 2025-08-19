// src/reference.js
// Reference Lookup – UX matches Grey Market: clear input, one full-detail card per result in #detailDock

(function () {
  'use strict';

  // IDs from index.html (already present)
  var input = document.getElementById('refQuery');
  var btn   = document.getElementById('refLookupBtn');
  var note  = document.getElementById('refResults');   // we reuse this only for "Searching…"
  var dock  = document.getElementById('detailDock');   // full-width result area (same as GM)

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function getFirst(obj, keys) {
    if (!obj) return '';
    for (var i=0;i<keys.length;i++){
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj,k)) {
        var v = obj[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
    }
    return '';
  }
  function fmtPriceFrom(obj) {
    var p = getFirst(obj, ['Price']);
    if (p) return String(p);
    var amt = getFirst(obj, ['PriceAmount']);
    var cur = getFirst(obj, ['PriceCurrency']) || 'USD';
    if (!amt) return '';
    var n = Number(String(amt).replace(/[^0-9.-]/g,''));
    if (!isNaN(n)) {
      try { return n.toLocaleString(undefined, { style:'currency', currency: cur, maximumFractionDigits: 0 }); }
      catch(e){ return String(amt) + (cur ? (' ' + cur) : ''); }
    }
    return String(amt) + (cur ? (' ' + cur) : '');
  }

  function buildReferenceCard(item, idx) {
    var card = document.createElement('div');
    card.className = 'card detail-card';
    card.style.marginBottom = '18px';
    card.setAttribute('data-idx', String(idx));

    // --- Title (Reference • Brand) ---
    var titleRef = getFirst(item, ['Reference']);
    var titleBrand = getFirst(item, ['Brand']);
    var h = document.createElement('h3');
    h.className = 'detail-title';
    h.style.margin = '0 0 8px 0';
    h.style.color = '#d4af37';
    h.textContent = titleRef ? (titleBrand ? (titleRef + ' • ' + titleBrand) : titleRef) : (titleBrand || 'Reference');

    // --- LEFT: figure out canonical fields first ---
    var left = document.createElement('div');
    left.style.minWidth = '0';
    left.appendChild(h);

    var dl = document.createElement('dl');
    dl.style.display = 'grid';
    dl.style.gridTemplateColumns = '1fr 1fr';
    dl.style.gap = '8px 20px';
    dl.style.margin = '0';

    function addKV(label, value) {
      var dt = document.createElement('dt');
      dt.textContent = label;
      dt.style.fontWeight = '700';
      dt.style.color = '#d4af37';
      dt.style.marginBottom = '2px';
      var dd = document.createElement('dd');
      dd.textContent = value && String(value).trim() !== '' ? String(value) : '—';
      dd.style.margin = '0 0 12px 0';
      dl.appendChild(dt); dl.appendChild(dd);
    }

    // canonical fields
    addKV('Reference', titleRef);
    addKV('Brand', titleBrand);
    addKV('Collection', getFirst(item, ['Collection']));
    addKV('Description', getFirst(item, ['Description']));
    addKV('Price', fmtPriceFrom(item));
    addKV('Source URL', getFirst(item, ['SourceURL']));

    // Calibre (nested)
    var cal = item && item.Calibre ? item.Calibre : null;
    if (cal && typeof cal === 'object') {
      addKV('Calibre Name', getFirst(cal, ['Name']));
      addKV('Functions', getFirst(cal, ['Functions']));
      addKV('Mechanism', getFirst(cal, ['Mechanism']));
      addKV('Frequency', getFirst(cal, ['Frequency']));
      addKV('Number of Jewels', getFirst(cal, ['NumberOfJewels']));
      addKV('Power Reserve', getFirst(cal, ['PowerReserve']));
      addKV('Thickness', getFirst(cal, ['Thickness']));
      addKV('Number Of Parts', getFirst(cal, ['NumberOfParts']));
    }

    // Keywords / Tags
    var kw = Array.isArray(item.Keywords) ? item.Keywords.join(', ') : getFirst(item, ['Keywords']);
    var tg = Array.isArray(item.Tags) ? item.Tags.join(', ') : getFirst(item, ['Tags']);
    if (kw) addKV('Keywords', kw);
    if (tg) addKV('Tags', tg);

    // ---- Include any other fields that weren't captured above (so we truly show "all data") ----
    var shown = {
      Reference:1, Brand:1, Collection:1, Description:1, Price:1, PriceAmount:1, PriceCurrency:1,
      SourceURL:1, ImageFilename:1, Image:1, ImageUrl:1, image:1, Keywords:1, Tags:1, Calibre:1
    };
    Object.keys(item).forEach(function(k){
      if (shown[k]) return;
      var v = item[k];
      if (v === null || v === undefined || String(v).trim && String(v).trim() === '') return;
      // stringify objects/arrays
      if (typeof v === 'object') {
        try { v = JSON.stringify(v); } catch {}
      }
      addKV(k, v);
    });

    left.appendChild(dl);

    // --- RIGHT: image (URL or filename under assets/references) ---
    var right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'start';
    right.style.justifyContent = 'center';
    right.style.minWidth = '220px';
    right.style.maxWidth = '340px';

    var rawImg = getFirst(item, ['ImageFilename', 'Image', 'image', 'ImageUrl']);
    var imgSrc = '';
    if (rawImg) {
      imgSrc = /^https?:\/\//i.test(rawImg) ? rawImg : ('assets/references/' + rawImg);
    }
    if (imgSrc) {
      var img = document.createElement('img');
      img.className = 'watch-image enlargeable-img';
      img.src = imgSrc;
      img.alt = titleRef || 'reference';
      img.style.maxWidth = '100%';
      img.style.border = '1px solid #d4af37';
      img.style.borderRadius = '8px';
      img.style.cursor = 'pointer';
      img.setAttribute('data-src', imgSrc);
      right.appendChild(img);
    } else {
      var ph = document.createElement('div');
      ph.style.width = '220px';
      ph.style.height = '160px';
      ph.style.display = 'flex';
      ph.style.alignItems = 'center';
      ph.style.justifyContent = 'center';
      ph.style.background = '#0f0f0f';
      ph.style.border = '1px dashed #444';
      ph.style.borderRadius = '8px';
      ph.textContent = 'No image';
      right.appendChild(ph);
    }

    // Layout: details (left) + image (right)
    card.style.display = 'grid';
    card.style.gridTemplateColumns = '1fr 340px';
    card.style.gap = '20px';
    card.style.alignItems = 'start';

    card.appendChild(left);
    card.appendChild(right);
    return card;
  }

  function attachImageModalHandlersIfAvailable() {
    var imgModal = document.getElementById('imgModal');
    var imgModalImg = document.getElementById('imgModalImg');
    if (!dock || !imgModal || !imgModalImg) return;

    dock.onclick = function (e) {
      var t = e.target;
      var img = t && t.closest ? t.closest('.enlargeable-img') : null;
      if (!img) return;
      var src = (img.dataset && img.dataset.src) ? img.dataset.src : img.src;
      if (!src) return;
      imgModalImg.src = src;
      imgModal.style.display = 'flex';
    };
    imgModal.onclick = function(){ imgModal.style.display = 'none'; };
    document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') imgModal.style.display = 'none'; });
  }

  async function lookupReference() {
    if (!input || !dock) {
      console.error('[REF] Missing required elements', { input: !!input, dock: !!dock });
      return;
    }
    var term = (input.value || '').trim();
    if (!term) return;

    if (note) note.innerHTML = '<div class="note">Searching…</div>';

    try {
      var url = '/.netlify/functions/referenceLookUp?q=' + encodeURIComponent(term) + '&limit=50';
      console.log('[REF] GET', url);
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      var raw = await res.text();

      var data;
      try { data = raw ? JSON.parse(raw) : []; }
      catch (e) {
        console.error('[REF] JSON parse error', e, 'raw:', raw.slice(0, 300));
        if (note) note.textContent = 'Error: invalid JSON from server';
        return;
      }

      if (!res.ok) {
        console.error('[REF] Server error payload:', data);
        if (note) note.textContent = (data && data.error) ? ('Error: ' + data.error) : 'Server error';
        return;
      }

      if (!Array.isArray(data)) data = [];
      console.log('[REF] results:', data.length);

      // clear "Searching…" and the input
      if (note) note.innerHTML = '';
      input.value = '';

      // render to the same full-width dock (like GM)
      dock.innerHTML = '';
      if (data.length === 0) {
        // intentionally no summary
        return;
      }
      data.forEach(function (item, idx) {
        var card = buildReferenceCard(item, idx);
        dock.appendChild(card);
      });

      // enable image modal (like GM)
      attachImageModalHandlersIfAvailable();

    } catch (err) {
      console.error('[REF] Fetch exception:', err);
      if (note) note.textContent = 'Network error fetching references';
    }
  }

  function wire() {
    if (btn) btn.addEventListener('click', lookupReference);
    if (input) {
      input.addEventListener('keydown', function(e){
        if (e.key === 'Enter') lookupReference();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
