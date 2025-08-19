// src/reference.js
// Reference Lookup – browser-side code
// - Uses existing CSS (.card, .manufacturer-line, .watch-image, .card-images)
// - Detailed logs with [RefLookup][UI] prefixes
// - Enter key triggers search
// - Safe JSON parsing + helpful error messages

(function () {
  const IDS = {
    input: 'refQuery',
    button: 'refLookupBtn',
    results: 'refResults',
  };

  const $ = (id) => document.getElementById(id);

  function renderCard(doc) {
    const ref = doc?.Reference || '';
    const brand = doc?.Brand || '';
    const collection = doc?.Collection ? ` | ${doc.Collection}` : '';
    const desc = doc?.Description || '';
    const calibre = doc?.Calibre?.Name ? `<div class="manufacturer-line"><em>${doc.Calibre.Name}</em></div>` : '';
    const img = doc?.ImageFilename ? `<img class="watch-image" src="${doc.ImageFilename}" alt="${ref}" />` : '';

    return `
      <div class="card">
        <div style="flex:1 1 auto;">
          <div class="manufacturer-line"><strong>${ref}</strong> — ${brand}${collection}</div>
          <div>${desc}</div>
          ${calibre}
        </div>
        ${img ? `<div class="card-images" style="max-width:220px;">${img}</div>` : ''}
      </div>
    `;
  }

  async function doReferenceLookup() {
    const input = $(IDS.input);
    const out = $(IDS.results);

    if (!input || !out) {
      console.error('[RefLookup][UI] Missing elements', { haveInput: !!input, haveResults: !!out });
      return;
    }

    const term = (input.value || '').trim();
    out.innerHTML = '';

    if (!term) {
      out.textContent = 'Enter a reference or keywords';
      return;
    }

    const url = `/.netlify/functions/referenceLookUp?q=${encodeURIComponent(term)}&limit=50`;
    console.debug('[RefLookup][UI] GET', url);

    const t0 = performance.now();
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const t1 = performance.now();
      console.debug('[RefLookup][UI] HTTP', res.status, res.statusText, 'in', Math.round(t1 - t0), 'ms');

      // Read as text first to help debug if JSON is malformed in prod
      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (e) {
        console.error('[RefLookup][UI] JSON parse error:', e, 'raw (first 400 chars):', raw.slice(0, 400));
        out.textContent = 'Error: invalid JSON from server';
        return;
      }

      if (!res.ok) {
        console.error('[RefLookup][UI] Server error payload:', data);
        out.textContent = (data && data.error) ? `Error: ${data.error}` : 'Server error';
        return;
      }

      const isArray = Array.isArray(data);
      console.debug('[RefLookup][UI] payload:', { type: isArray ? 'array' : typeof data, length: isArray ? data.length : undefined });

      if (!isArray || data.length === 0) {
        out.textContent = `No results for “${term}”.`;
        return;
      }

      out.innerHTML = data.map(renderCard).join('');
    } catch (err) {
      console.error('[RefLookup][UI] Fetch exception:', err);
      out.textContent = 'Network error fetching references';
    }
  }

  function wireEvents() {
    const btn = $(IDS.button);
    const input = $(IDS.input);

    if (btn) btn.addEventListener('click', doReferenceLookup);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doReferenceLookup();
      });
    }

    // Optional: focus for fast testing
    // input?.focus();
  }

  document.addEventListener('DOMContentLoaded', wireEvents);
})();
