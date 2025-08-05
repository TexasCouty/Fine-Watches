// ==========================
// main.js
// ==========================

// ==========================
// Data & state
// ==========================
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;

// ==========================
// Date helpers
// ==========================
function toDateInputValue(dateString) {
  if (!dateString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = new Date(dateString);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

function parseDate(d) {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  const parts = d.split(/[\/-]/);
  if (parts.length === 3) {
    // detect dd/mm/yyyy vs yyyy-mm-dd
    if (parts[2].length === 4) {
      const [a, b, c] = parts.map(Number);
      return a > 12 ? new Date(c, b - 1, a) : new Date(c, a - 1, b);
    } else if (parts[0].length === 4) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  return new Date(d);
}

// ==========================
// Fetch for autocomplete
// ==========================
async function fetchGreyMarketData() {
  try {
    const res = await fetch('/.netlify/functions/greyMarketLookup?term=');
    if (!res.ok) throw new Error('Failed to fetch grey market data');
    greyMarketData = await res.json();
    const names = [...new Set(
      greyMarketData
        .map(i => i['Model Name'])
        .filter(Boolean)
        .map(n => n.toUpperCase())
    )];
    modelNameSuggestions = names.sort();
  } catch (e) {
    console.error('Error loading grey market data:', e);
  }
}

// ==========================
// Form show / hide / clear
// ==========================
function clearGreyMarketForm() {
  const ids = ['gm_unique_id','gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname','gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready','gm_current_retail','gm_dealer','gm_comments'];
  ids.forEach(id => {
    if (id !== 'gm_model_name') document.getElementById(id).value = '';
  });
  currentEditingGMModel = null;
  document.getElementById('gm_delete_button').style.display = 'none';
  hideRecordPicker();
  document.getElementById('greyMarketFormContainer').style.display = 'none';
}

function showAddGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById('greyMarketFormTitle').innerText = 'Add New Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
}

function showEditGreyMarketForm(record) {
  document.getElementById('greyMarketFormTitle').innerText = 'Edit Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  document.getElementById('gm_unique_id').value = record['Unique ID'] || record.uniqueId || '';
  document.getElementById('gm_date_entered').value = toDateInputValue(record['Date Entered']);
  document.getElementById('gm_year').value = record['Year'] || '';
  document.getElementById('gm_model').value = record['Model'] || '';
  document.getElementById('gm_model_name').value = record['Model Name'] || '';
  document.getElementById('gm_nickname').value = record['Nickname or Dial'] || '';
  document.getElementById('gm_bracelet').value = record['Bracelet'] || '';
  document.getElementById('gm_bracelet_metal_color').value = record['Bracelet Metal/Color'] || '';
  document.getElementById('gm_price').value = record['Price'] || '';
  document.getElementById('gm_full_set').value = record['Full Set'] || '';
  document.getElementById('gm_retail_ready').value = record['Retail Ready'] || '';
  document.getElementById('gm_current_retail').value = record['Current Retail (Not Inc Tax)'] || '';
  document.getElementById('gm_dealer').value = record['Dealer'] || '';
  document.getElementById('gm_comments').value = record['Comments'] || '';

  currentEditingGMModel = record['Model'];
  document.getElementById('gm_delete_button').style.display = 'inline-block';

  const imgEl = document.getElementById('gm_current_img');
  if (record.ImageFilename) {
    imgEl.src = record.ImageFilename.startsWith('http')
      ? record.ImageFilename
      : 'assets/grey_market/' + record.ImageFilename;
    imgEl.style.display = 'block';
  } else {
    imgEl.src = '';
    imgEl.style.display = 'none';
  }
}

function cancelGreyMarketForm() {
  clearGreyMarketForm();
}

// ==========================
// Save Entry (unchanged)
// ==========================
async function saveGreyMarketEntry() {
  const Model = document.getElementById('gm_model').value.trim();
  const fields = {
    'Unique ID': document.getElementById('gm_unique_id').value.trim(),
    'Date Entered': document.getElementById('gm_date_entered').value.trim(),
    Year: document.getElementById('gm_year').value.trim(),
    Model,
    'Model Name': document.getElementById('gm_model_name').value.trim(),
    'Nickname or Dial': document.getElementById('gm_nickname').value.trim(),
    Bracelet: document.getElementById('gm_bracelet').value.trim(),
    'Bracelet Metal/Color': document.getElementById('gm_bracelet_metal_color').value.trim(),
    Price: document.getElementById('gm_price').value.trim(),
    'Full Set': document.getElementById('gm_full_set').value.trim(),
    'Retail Ready': document.getElementById('gm_retail_ready').value.trim(),
    'Current Retail (Not Inc Tax)': document.getElementById('gm_current_retail').value.trim(),
    Dealer: document.getElementById('gm_dealer').value.trim(),
    Comments: document.getElementById('gm_comments').value.trim(),
  };

  const uniqueId = fields['Unique ID'];
  const imageInput = document.getElementById('gm_image');
  let imageUrl = '';
  if (imageInput && imageInput.files && imageInput.files[0]) {
    const data = new FormData();
    data.append('file', imageInput.files[0]);
    data.append('upload_preset', 'unsigned_preset');
    const cloudName = 'dnymcygtl';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: data
    });
    const imgData = await res.json();
    imageUrl = imgData.secure_url;
    const imgEl = document.getElementById('gm_current_img');
    imgEl.src = imageUrl;
    imgEl.style.display = 'block';
  } else {
    imageUrl = document.getElementById('gm_current_img').src || '';
  }
  fields.ImageFilename = imageUrl;

  if (!Model) {
    alert('Model is required.');
    return;
  }

  const postBody = { uniqueId, fields };
  console.log('--- Save Entry Debug ---', postBody);

  try {
    const res = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });
    const result = await res.json();
    if (res.ok) {
      alert('Entry updated!');
      clearGreyMarketForm();
      lookupCombinedGreyMarket();
    } else {
      alert('Error: ' + (result.error || 'Could not update entry'));
    }
  } catch (e) {
    alert('Network or server error');
    console.error(e);
  }
}

// ==========================
// Unified Search
// ==========================
async function lookupCombinedGreyMarket() {
  const term = document.getElementById('combinedSearchInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  console.log('[Unified Search] Searching for:', term);
  if (!term) {
    alert('Enter Model, Model Name, or Nickname/Dial');
    return;
  }

  resultsDiv.innerHTML = '<div>Searching Grey Market…</div>';
  try {
    const res = await fetch(`/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(term)}`);
    const data = await res.json();

    // sort newest → oldest
    data.sort((a, b) => parseDate(b['Date Entered']) - parseDate(a['Date Entered']));

    if (!Array.isArray(data)) {
      console.error('Unexpected response format:', data);
      resultsDiv.innerHTML = '<div>Error: invalid response</div>';
      return;
    }

    console.log('[Unified Search] Found', data.length, 'results');
    if (data.length === 0) {
      resultsDiv.innerHTML = '<div>No Grey Market matches found.</div>';
    } else {
      renderGreyMarketResults(data);
    }
  } catch (err) {
    console.error('[Unified Search] Fetch error:', err);
    resultsDiv.innerHTML = '<div>Error fetching grey market data.</div>';
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

// ==========================
// Render results (UNCHANGED)
// ==========================
function renderGreyMarketResults(data) {
  // … your existing implementation here, unchanged …
}

// ==========================
// Table sorting (UNCHANGED)
// ==========================
function sortTable(n) {
  // … unchanged …
}

// ==========================
// Hide autocomplete picker
// ==========================
function hideRecordPicker() {
  const picker = document.getElementById('gmRecordPicker');
  if (picker) picker.style.display = 'none';
}

// ==========================
// Image modal handlers
// ==========================
function addImageModalHandlers() {
  // … unchanged …
}

// ==========================
// On load
// ==========================
window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

// Expose form & save
window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
