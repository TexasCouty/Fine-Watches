// --- Grey Market CRUD & Autocomplete ---
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;

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

// ------ Add this block to handle showing the image ------
  if (record.ImageFilename) {
    document.getElementById('gm_current_img').src = record.ImageFilename;
    document.getElementById('gm_current_img').style.display = 'block';
  } else {
    document.getElementById('gm_current_img').src = '';
    document.getElementById('gm_current_img').style.display = 'none';
  }
  // --------------------------------------------------------

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

    const cloudName = 'dnmycgtl'; // Your Cloudinary cloud name
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
  const modelKey = currentEditingGMModel || Model;
  if (!modelKey) {
    alert('Model is required.');
    return;
  }

  try {
    const res = await fetch('/.netlify/functions/updateGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Model: modelKey, fields })
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

// --- Grey Market Lookup (desktop: card, mobile: table) ---
async function lookupGreyMarket() {
  const ref = document.getElementById('greyMarketInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  if (!ref) {
    alert('Enter a model number.');
    return;
  }
  resultsDiv.innerHTML = '<div>Searching Grey Market...</div>';
  try {
    const res = await fetch(`/.netlify/functions/greyMarketLookup?reference=${encodeURIComponent(ref)}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (!data.length) {
      resultsDiv.innerHTML = '<div>No Grey Market matches found.</div>';
      return;
    }
    let html = '';

    // Desktop: card layout
    if (window.innerWidth >= 768) {
      html = data.map(item => {
        const img = item.ImageFilename
          ? `<img src="assets/grey_market/${item.ImageFilename}" style="max-width:200px; margin-right:20px; border-radius:8px;" onerror="this.style.display='none';" />`
          : '';
        return `
          <div class="card" style="display:flex;gap:20px;padding:15px;margin-bottom:20px;border:1px solid gold;border-radius:10px;">
            ${img}
            <div>
              <p><strong>Model:</strong> ${item.Model}</p>
              <p><strong>Date Entered:</strong> ${item["Date Entered"]}</p>
              <p><strong>Year:</strong> ${item.Year}</p>
              <p><strong>Model Name:</strong> ${item["Model Name"]}</p>
              <p><strong>Nickname/Dial:</strong> ${item["Nickname or Dial"]}</p>
              <p><strong>Bracelet:</strong> ${item.Bracelet}</p>
              <p><strong>Bracelet Metal/Color:</strong> ${item["Bracelet Metal/Color"]}</p>
              <p><strong>Full Set:</strong> ${item["Full Set"]}</p>
              <p><strong>Retail Ready:</strong> ${item["Retail Ready"]}</p>
              <p><strong>Grey Market Price:</strong> ${item.Price || ''}</p>
              <p><strong>Current Retail: </strong>${item["Current Retail (Not Inc Tax)"]}</p>
              <p><strong>Dealer:</strong> ${item.Dealer}</p>
              <p><strong>Comments:</strong> ${item.Comments}</p>
              <button onclick='showEditGreyMarketForm(${JSON.stringify(item).replace(/'/g,"\\'")})'>Edit</button>
            </div>
          </div>`;
      }).join('');
    } else {
      // Mobile: table layout
      const headers = [
        "Date Entered","Year","Model","Model Name","Nickname or Dial",
        "Bracelet","Bracelet Metal/Color","Grey Market Price","Full Set","Retail Ready",
        "Current Retail","Dealer","Comments","Actions"
      ];
      html = `<table id="greyMarketTable"><thead><tr>${
        headers.map((h,i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')
      }</tr></thead><tbody>`;
      data.forEach(item => {
        html += `<tr>
          <td data-label="Date Entered">${item["Date Entered"]||''}</td>
          <td data-label="Year">${item.Year||''}</td>
          <td data-label="Model">${item.Model||''}${
            item.ImageFilename
              ? `<br><img src="assets/grey_market/${item.ImageFilename}" style="max-width:120px;margin-top:5px;" onerror="this.style.display='none';">`
              : ''
          }</td>
          <td data-label="Model Name">${item["Model Name"]||''}</td>
          <td data-label="Nickname or Dial">${item["Nickname or Dial"]||''}</td>
          <td data-label="Bracelet">${item.Bracelet||''}</td>
          <td data-label="Bracelet Metal/Color">${item["Bracelet Metal/Color"]||''}</td>
          <td data-label="Grey Market Price">${item.Price||''}</td>
          <td data-label="Full Set">${item["Full Set"]||''}</td>
          <td data-label="Retail Ready">${item["Retail Ready"]||''}</td>
          <td data-label="Current Retail">${item["Current Retail (Not Inc Tax)"]||''}</td>
          <td data-label="Dealer">${item.Dealer||''}</td>
          <td data-label="Comments">${item.Comments||''}</td>
          <td data-label="Actions"><button onclick='showEditGreyMarketForm(${JSON.stringify(item).replace(/'/g,"\\'")})'>Edit</button></td>
        </tr>`;
      });
      html += `</tbody></table>`;
    }

    resultsDiv.innerHTML = html;
  } catch (err) {
    resultsDiv.innerHTML = `<div>Error fetching grey market data.</div>`;
    console.error(err);
  }
}

// --- Sortable Table ---
function sortTable(n) {
  const table = document.getElementById("greyMarketTable");
  if (!table) return;
  let switching = true, dir = "asc", switchcount = 0;
  while (switching) {
    switching = false;
    const rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      let x = rows[i].getElementsByTagName("TD")[n];
      let y = rows[i + 1].getElementsByTagName("TD")[n];
      if ((dir === "asc" && x.innerText.toLowerCase() > y.innerText.toLowerCase()) ||
          (dir === "desc" && x.innerText.toLowerCase() < y.innerText.toLowerCase())) {
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else if (switchcount === 0 && dir === "asc") {
      dir = "desc";
      switching = true;
    }
  }
}

// --- (Optional) Autocomplete/Record Picker for Model Name (if used) ---
function hideRecordPicker() {
  const picker = document.getElementById('gmRecordPicker');
  if (picker) picker.style.display = 'none';
}

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
