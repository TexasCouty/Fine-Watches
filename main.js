console.log("🚨 Netlify ENV MONGO_URI:", process.env.MONGO_URI);

// Testing Clean Directory
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;

// --- Date helper for date input compatibility ---
function toDateInputValue(dateString) {
  if (!dateString) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toISOString().slice(0, 10);
}

async function fetchGreyMarketData() {
  try {
    const res = await fetch('/.netlify/functions/greyMarketLookup?reference=');
    if (!res.ok) throw new Error('Failed to fetch grey market data');
    greyMarketData = await res.json();
    const names = [...new Set(greyMarketData.map(i => i['Model Name']).filter(Boolean).map(n => n.toUpperCase()))];
    modelNameSuggestions = names.sort();
  } catch (e) {
    console.error('Error loading grey market data:', e);
  }
}

function clearGreyMarketForm() {
  const ids = [
    'gm_unique_id','gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname','gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready','gm_current_retail','gm_dealer','gm_comments'
  ];
  ids.forEach(id => { if (id !== 'gm_model_name') document.getElementById(id).value = ''; });
  currentEditingGMModel = null;
  document.getElementById('gm_delete_button').style.display = 'none';
  hideRecordPicker();
  document.getElementById('greyMarketFormContainer').style.display = 'none';
}

function showAddGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById('greyMarketFormTitle').innerText = 'Add New Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  currentEditingGMModel = null;
  document.getElementById('gm_delete_button').style.display = 'none';
}

function showEditGreyMarketForm(record) {
  document.getElementById('greyMarketFormTitle').innerText = 'Edit Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  document.getElementById('gm_unique_id').value = record["Unique ID"] || record["uniqueId"] || "";
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
  if (record.ImageFilename) {
    if (record.ImageFilename.startsWith('http')) {
      document.getElementById('gm_current_img').src = record.ImageFilename;
    } else {
      document.getElementById('gm_current_img').src = 'assets/grey_market/' + record.ImageFilename;
    }
    document.getElementById('gm_current_img').style.display = 'block';
  } else {
    document.getElementById('gm_current_img').src = '';
    document.getElementById('gm_current_img').style.display = 'none';
  }
}

function cancelGreyMarketForm() {
  clearGreyMarketForm();
}

async function saveGreyMarketEntry() {
  const Model = document.getElementById('gm_model').value.trim();
  const fields = {
    "Unique ID": document.getElementById('gm_unique_id').value.trim(),
    "Date Entered": document.getElementById('gm_date_entered').value.trim(),
    "Year": document.getElementById('gm_year').value.trim(),
    "Model": Model,
    "Model Name": document.getElementById('gm_model_name').value.trim(),
    "Nickname or Dial": document.getElementById('gm_nickname').value.trim(),
    "Bracelet": document.getElementById('gm_bracelet').value.trim(),
    "Bracelet Metal/Color": document.getElementById('gm_bracelet_metal_color').value.trim(),
    "Price": document.getElementById('gm_price').value.trim(),
    "Full Set": document.getElementById('gm_full_set').value.trim(),
    "Retail Ready": document.getElementById('gm_retail_ready').value.trim(),
    "Current Retail (Not Inc Tax)": document.getElementById('gm_current_retail').value.trim(),
    "Dealer": document.getElementById('gm_dealer').value.trim(),
    "Comments": document.getElementById('gm_comments').value.trim()
  };

  const uniqueId = fields["Unique ID"];
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
    document.getElementById('gm_current_img').src = imageUrl;
    document.getElementById('gm_current_img').style.display = 'block';
  } else if (document.getElementById('gm_current_img').src) {
    imageUrl = document.getElementById('gm_current_img').src;
  }
  fields["ImageFilename"] = imageUrl;

  const modelKey = currentEditingGMModel || Model;
  if (!modelKey) {
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

// ✅ Unified Search Function
async function lookupCombinedGreyMarket() {
  const searchTerm = document.getElementById('combinedSearchInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  if (!searchTerm) {
    alert('Enter a search term.');
    return;
  }

  resultsDiv.innerHTML = '<div>Searching Grey Market...</div>';
  console.log("🔍 Unified search term:", searchTerm);

  try {
    const res = await fetch(`/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(searchTerm)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      resultsDiv.innerHTML = '<div>No Grey Market matches found.</div>';
      return;
    }
    renderGreyMarketResults(data);
  } catch (err) {
    resultsDiv.innerHTML = `<div>Error fetching grey market data.</div>`;
    console.error(err);
  }

  document.getElementById('combinedSearchInput').value = '';
  document.getElementById('combinedSearchInput').blur();
}

// ====== Keep your existing renderGreyMarketResults, sortTable, image modal handlers ======

window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;
window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
