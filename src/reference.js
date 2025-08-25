// src/reference.js
// Reference Lookup — richer details, clickable Source URL,
// backwards compatible with your existing page and modal.

(function () {
  'use strict';

  var input = document.getElementById('refQuery');
  var btn   = document.getElementById('refLookupBtn');
  var note  = document.getElementById('refResults');
  var dock  = document.getElementById('detailDock');

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function getFirst(obj, keys) {
    if (!obj) return '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
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
    var n = Number(String(amt).replace(/[^0-9.-]/g, ''));
    if (!isNaN(n)) {
      try { return n.toLocaleString(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }); }
      catch (e) { /* fall back below */ }
    }
    return String(amt) + (cur ? (' ' + cur) : '');
  }

  function renderRow(label, valueHtml) {
    if (!valueHtml) return '';
    return '<p><strong>' + escapeHtml(label) + ':</strong> ' + valueHtml + '</p>';
  }

  function renderSpecs(specsObj) {
    if (!specsObj || typeof specsObj !== 'object') return '';
    var keys = Object.keys(specsObj);
    if (keys.length === 0) return '';
    var rows = '';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = specsObj[k];
      if (v === undefined || v === null || String(v).trim() === '') continue;
      rows += '<li><span style="opacity:.85">' + escapeHtml(k) + '</span>: ' + escapeHtml(v) + '</li>';
    }
    if (!rows) return '';
    return '<div style="margin-top:6px"><strong>Specs</strong><ul style="margin:6px 0 0 18px">' + rows + '</ul></div>';
  }

  function renderArray(label, arrOrStr) {
    if (Array.isArray(arrOrStr)) {
      if (arrOrStr.length === 0) return '';
      return renderRow(label, escapeHtml(arrOrStr.join(', ')));
    }
    if (!arrOrStr) return '';
    return renderRow(label, escapeHtml(String(arrOrStr)));
  }

  function buildRefDetailCard(item, idx) {
    var card = document.createElement('div');
    card.className = 'card detail-card';
    card.style.display = 'flex';
    card.style.gap = '20px';
    card.style.padding = '15px';
    card.style.marginBottom = '20px';
    card.style.border = '1px solid #d4af37';
    card.style.borderRadius = '10px';
    card.style.alignItems = 'flex-start';
    card.setAttribute('data-idx', String(idx));

    // ----- IMAGE (first) -----
    var rawImg = getFirst(item, ['ImageFilename', 'Image', 'image', 'ImageUrl']);
    var imgSrc = rawImg ? (/^https?:\/\//i.test(rawImg) ? rawImg : ('assets/references/' + rawImg)) : '';
    var imgHtml = imgSrc
      ? '<img src="' + escapeHtml(imgSrc) + '" class="enlargeable-img" ' +
        'style="max-width:200px;margin-right:20px;border-radius:8px;cursor:pointer;" ' +
        'onerror="this.style.display=\'none\';" data-src="' + escapeHtml(imgSrc) + '" />'
      : '';

    // ----- Simple fields -----
    var reference    = getFirst(item, ['Reference']);
    var brand        = getFirst(item, ['Brand']);
    var collection   = getFirst(item, ['Collection']);
    var description  = getFirst(item, ['Description']);
    var details      = getFirst(item, ['Details']);
    var caseTxt      = getFirst(item, ['Case']);
    var dial         = getFirst(item, ['Dial']);
    var bracelet     = getFirst(item, ['Bracelet']);
    var priceStr     = fmtPriceFrom(item);
    var lastUpdated  = getFirst(item, ['LastUpdated']);

    // Aliases (array)
    var aliases = Array.isArray(item && item.Aliases) ? item.Aliases : [];

    // Source URL (clickable)
    var sourceUrl = getFirst(item, ['SourceURL']);
    var sourceHtml = '';
    if (sourceUrl) {
      var safeHref = escapeHtml(sourceUrl);
      sourceHtml = '<a href="' + safeHref + '" target="_blank" rel="noopener">' + safeHref + '</a>';
    }

    // Calibre
    var cal          = item && item.Calibre ? item.Calibre : null;
    var calName      = getFirst(cal, ['Name']);
    var calFunctions = getFirst(cal, ['Functions']);
    var calMechanism = getFirst(cal, ['Mechanism']);
    var calFreq      = getFirst(cal, ['Frequency']);
    var calJewels    = getFirst(cal, ['NumberOfJewels']);
    var calReserve   = getFirst(cal, ['PowerReserve']);
    var calThick     = getFirst(cal, ['Thickness']);
    var calNumParts  = getFirst(cal, ['NumberOfParts']);

    // Specs object (arbitrary keys)
    var specsHtml = renderSpecs(item && item.Specs ? item.Specs : null);

    // Optional arrays like Keywords/Tags if present
    var keywords = Array.isArray(item && item.Keywords) ? item.Keywords : (getFirst(item || {}, ['Keywords']) || '');
    var tags     = Array.isArray(item && item.Tags) ? item.Tags : (getFirst(item || {}, ['Tags']) || '');

    var html =
      imgHtml +
      '<div style="flex:1 1 auto;">' +
        renderRow('Reference', reference && escapeHtml(reference)) +
        renderRow('Brand', brand && escapeHtml(brand)) +
        renderRow('Collection', collection && escapeHtml(collection)) +
        renderRow('Description', description && escapeHtml(description)) +
        renderRow('Details', details && escapeHtml(details)) +
        renderRow('Case', caseTxt && escapeHtml(caseTxt)) +
        renderRow('Dial', dial && escapeHtml(dial)) +
        renderRow('Bracelet', bracelet && escapeHtml(bracelet)) +
        renderRow('Price', priceStr && escapeHtml(priceStr)) +
        renderRow('Last Updated', lastUpdated && escapeHtml(lastUpdated)) +
        renderArray('Aliases', aliases) +
        renderRow('Source URL', sourceHtml) +

        (calName      ? renderRow('Calibre Name', escapeHtml(calName)) : '') +
        (calFunctions ? renderRow('Functions',    escapeHtml(calFunctions)) : '') +
        (calMechanism ? renderRow('Mechanism',    escapeHtml(calMechanism)) : '') +
        (calFreq      ? renderRow('Frequency',    escapeHtml(calFreq)) : '') +
        (calJewels    ? renderRow('Number of Jewels', escapeHtml(calJewels)) : '') +
        (calReserve   ? renderRow('Power Reserve', escapeHtml(calReserve)) : '') +
        (calThick     ? renderRow('Thickness', escapeHtml(calThick)) : '') +
        (calNumParts  ? renderRow('Number of Parts', escapeHtml(calNumParts)) : '') +

        (specsHtml ? specsHtml : '') +
        (keywords && keywords.length ? renderArray('Keywords', keywords) : '') +
        (tags && tags.length ? renderArray('Tags', tags) : '') +
      '</div>';

    card.innerHTML = html;
    return card;
  }

  function attachImageModalHandlersIfAvailable() {
    var modal = document.getElementById('imgModal');
    var modalImg = document.getElementById('imgModalImg');
    if (!dock || !modal || !modalImg) return;

    dock.onclick = function (e) {
      var t = e.target;
      var img = t && t.closest ? t.closest('.enlargeable-img') : null;
      if (!img) return;
      var src = (img.dataset && img.dataset.src) ? img.dataset.src : img.src;
      if (!src) return;
      modalImg.src = src;
      modal.style.display = 'flex';
    };
    modal.onclick = function(){ modal.style.display = 'none'; };
    document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') modal.style.display = 'none'; });
  }

  async function lookupReference() {
    if (!input || !dock) return;
    var term = (input.value || '').trim();
    if (!term) return;

    if (note) note.innerHTML = '<div class="note">Searching…</div>';

    try {
      var url = '/.netlify/functions/referenceLookUp?q=' + encodeURIComponent(term) + '&limit=50';
      var res = await fetch(url, { headers: { Accept: 'application/json' } });
      var raw = await res.text();

      var data;
      try { data = raw ? JSON.parse(raw) : []; }
      catch (e) {
        console.error('[REF] JSON parse error', e, raw.slice(0, 300));
        if (note) note.textContent = 'Error: invalid JSON from server';
        return;
      }

      if (!res.ok) {
        console.error('[REF] Server error payload:', data);
        if (note) note.textContent = (data && data.error) ? ('Error: ' + data.error) : 'Server error';
        return;
      }

      if (!Array.isArray(data)) data = [];

      // Clear status + input; render
      if (note) note.innerHTML = '';
      input.value = '';

      dock.innerHTML = '';
      if (data.length === 0) {
        dock.innerHTML =
          '<div class="note empty">No matches found.<br><small>Try a different reference, brand, collection, or keyword.</small></div>';
        return;
      }

      for (var i = 0; i < data.length; i++) {
        dock.appendChild(buildRefDetailCard(data[i], i));
      }

      attachImageModalHandlersIfAvailable();

    } catch (err) {
      console.error('[REF] Fetch exception:', err);
      if (note) note.textContent = 'Network error fetching references';
    }
  }

  function wire() {
    if (btn) btn.addEventListener('click', lookupReference);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') lookupReference();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
