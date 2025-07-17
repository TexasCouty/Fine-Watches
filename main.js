// --- Grey Market CRUD & Autocomplete ---
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;
let currentEditingGMUniqueId = null; // <-- This is what matters!

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
    'gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname','gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready','gm_current_retail','gm_dealer','gm_comments'
  ];
  ids.forEach(id => { if (id !== 'gm_model_name') document.getElementById(id).value = ''; });
  currentEditingGMModel = null;
  currentEditingGMUniqueId = null; // <-- Reset on clear
  document.getElementById('gm_delete_button').style.display = 'none';
  hideRecordPicker();
  document.getElementById('greyMarketFormContainer').style.display = 'none';
}

function showAddGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById('greyMarketFormTitle').innerText = 'Add New Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  currentEditingGMModel = null;
  currentEditingGMUniqueId = null; // <-- Reset for add
  document.getElementById('gm_delete_button').style.display = 'none';
}

function showEditGreyMarketForm(record) {
  currentEditingGMUniqueId = record["Unique ID"]; // <-- Always set this!
  document.getElementById('greyMarketFormTitle').innerText = 'Edit Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  document.getElementById('gm_date_entered').value = record['Date Entered'] || '';
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

  // Show the current image if present
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

  // --- Cloudinary Upload Section ---
  const imageInput = document.getElementById('gm_image');
  let imageUrl = '';

  // Only upload if a new file was selected
  if (imageInput && imageInput.files && imageInput.files[0]) {
    const data = new FormData();
    data.append('file', imageInput.files[0]);
    data.append('upload_preset', 'unsigned_preset'); // Your Cloudinary upload preset

    const cloudName = 'dnymcygtl'; // Your Cloudinary cloud name
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: data
    });
    const imgData = await res.json();
    imageUrl = imgData.secure_url; // This is the hosted image URL

    // Optionally, show the uploaded image immediately
    document.getElementById('gm_current_img').src = imageUrl;
    document.getElementById('gm_current_img').style.display = 'block';
  } else if (document.getElementById('gm_current_img').src) {
    imageUrl = document.getElementById('gm_current_img').src;
  }

  fields["ImageFilename"] = imageUrl;

  // --- Continue to Save to Backend ---
  if (!currentEditingGMUniqueId) {
    alert('Unique ID is required.');
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uniqueId: currentEditingGMUniqueId, fields }) // <-- POST uniqueId, not Model
    });
    const result = await res.json();
    if (res.ok) {
      alert('Entry updated!');
      clearGreyMarketForm();
      lookupGreyMarket(); // refresh results
    } else {
      alert('Error: ' + (result.error || 'Could not update entry'));
    }
  } catch (e) {
    alert('Network or server error');
    console.error(e);
  }
}

// --- Parse date utility for robust sorting ---
function parseDate(d) {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  let parts = d.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // MM/DD/YYYY or DD/MM/YYYY
      let [a, b, c] = parts.map(Number);
      if (a > 12) return new Date(c, b - 1, a); // DD/MM/YYYY
      return new Date(c, a - 1, b);             // MM/DD/YYYY
    } else if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  return new Date(d);
}

// --- Grey Market Lookup (desktop: card, mobile: table) ---
// ... no changes, leave as you had it ...
// ... rest of your code unchanged ...

// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

// --- Expose for inline handlers ---
window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
window.sortTable = sortTable;
window.lookupGreyMarket = lookupGreyMarket;  
