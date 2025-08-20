// src/reference.js
// Reference Lookup — identical UX/visuals to Grey Market:
// - Image first (so on mobile it stacks above details, like GM)
// - Label/value rows using <p><strong>Label:</strong> value</p>
// - Clears input after search
// - Renders one full-detail card per match in #detailDock
// - Shows a friendly "No matches found" message when empty

(function () {
  'use strict';

  var input = document.getElementById('refQuery');        // search box (right card)
  var btn   = document.getElementById('refLookupBtn');    // search button (right card)
  var note  = document.getElementById('refResults');      // small area where "Searching…" is shown
  var dock  = document.getElementById('detailDock');      // wide area under both cards (same as GM)

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
      catch (e) { /* fallback below */ }
    }
    return String(amt) + (cur ? (' ' + cur) : '');
  }

  function buildRefDetailCard(item, idx) {
    var card = document.createElement('div');
    card.className = 'card detail-card';
    // match GM inline safety styles
    card.style.display = 'flex';
    card.style.gap = '20px';
    card.style.padding = '15px';
    card.style.marginBottom = '20px';
    card.style.border = '1px solid #d4af37';
    card.style.borderRadius = '10px';
    card.style.alignItems = 'flex-start';
    card.setAttribute('data-idx', String(idx));

    // ----- IMAGE (first in DOM so mobile shows it on top) -----
    var rawImg = getFirst(item, ['ImageFilename', 'Image', 'image', 'ImageUrl']);
    var imgSrc = '';
    if (rawImg) imgSrc = /^https?:\/\//i.test(rawImg) ? rawImg : ('assets/references/' + rawImg);

    var imgHtml = '';
    if (imgSrc) {
      imgHtml =
        '<img src="' + escapeHtml(imgSrc) + '" ' +
        'class="enlargeable-img" ' +
        'style="max-width:200px;margin-right:20px;border-radius:8px;cursor:pointer;" ' +
        'onerror="this.style.display=\'none\';" ' +
        'data-src="' + escapeHtml(imgSrc) + '" />';
    }

    // ----- DETAILS (same structure as GM: <p><strong>Label:</strong> value</p>) -----
    var reference   = escapeHtml(getFirst(item, ['Reference']) || '');
    var brand       = escapeHtml(getFirst(item, ['Brand']) || '');
    var collection  = escapeHtml(getFirst(item, ['Collection']) || '');
    var description = escapeHtml(getFirst(item, ['Description']) || '');
    var price       = escapeHtml(fmtPriceFrom(item) || '');
    var sourceUrl   = escapeHtml(getFirst(item, ['SourceURL']) || '');

    // Calibre (nested)
    var cal            = item && item.Calibre ? item.Calibre : null;
    var calName        = escapeHtml(getFirst(cal || {}, ['Name']) || '');
    var calFunctions   = escapeHtml(getFirst(cal || {}, ['Functions']) || '');
    var calMechanism   = escapeHtml(getFirst(cal || {}, ['Mechanism']) || '');
    var calFreq        = escapeHtml(getFirst(cal || {}, ['Frequency']) || '');
    var calJewels      = escapeHtml(getFirst(cal || {}, ['NumberOfJewels']) || '');
    var calReserve     = escapeHtml(getFirst(cal || {}, ['PowerReserve']) || '');
    var calThickness   = escapeHtml(getFirst(cal || {}, ['Thickness']) || '');
    var calNumParts    = escapeHtml(getFirst(cal || {}, ['NumberOfParts']) || '');

    // Arrays
    var keywords = Array.isArray(item && item.Keywords) ? item.Keywords.join(', ')
                   : (getFirst(item || {}, ['Keywords']) || '');
    var tags     = Array.isArray(item && item.Tags) ? item.Tags.join(', ')
                   : (getFirst(item || {}, ['Tags']) || '');

    var detailsHtml =
      '<div style="flex:1 1 auto;">' +
        (reference   ? '<p><strong>Reference:</strong> ' + reference   + '</p>' : '') +
        (brand       ? '<p><strong>Brand:</strong> '     + brand       + '</p>' : '') +
        (collection  ? '<p><strong>Collection:</strong> '+ collection  + '</p>' : '') +
        (description ? '<p><strong>Description:</strong>'+ description + '</p>' : '') +
        (price       ? '<p><strong>Price:</strong> '     + price       + '</p>' : '') +
        (sourceUrl   ? '<p><strong>Source URL:</strong> '+ sourceUrl   + '</p>' : '') +

        (calName     ? '<p><strong>Calibre Name:</strong> '    + calName      + '</p>' : '') +
        (calFunctions? '<p><strong>Functions:</strong> '       + calFunctions + '</p>' : '') +
        (calMechanism? '<p><strong>Mechanism:</strong> '       + calMechanism + '</p>' : '') +
        (calFreq     ? '<p><strong>Frequency:</strong> '       + calFreq      + '</p>' : '') +
        (calJewels   ? '<p><strong>Number of Jewels:</strong> '+ calJewels    + '</p>' : '') +
        (calReserve  ? '<p><strong>Power Reserve:</strong> '   + calReserve   + '</p>' : '') +
        (calThickness? '<p><strong>Thickness:</strong> '       + calThickness + '</p>' : '') +
        (calNumParts ? '<p><strong>Number Of Parts:</strong> ' + calNumParts  + '</p>' : '') +

        (keywords    ? '<p><strong>Keywords:</strong> '        + escapeHtml(keywords) + '</p>' : '') +
        (tags        ? '<p><strong>Tags:</strong> '            + escapeHtml(tags)     + '</p>' : '') +
      '</div>';

    card.innerHTML = imgHtml + detailsHtml; // image first (like GM)
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

      // Clear "Searching…" and the input
      if (note) note.innerHTML = '';
      input.value = '';

      // Render into dock exactly like GM
      dock.innerHTML = '';
      if (data.length === 0) {
        dock.innerHTML =
          '<div class="note empty">No matches found.<br><small>Try a different model, nickname, dealer, or reference.</small></div>';
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
