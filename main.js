// main.js

let currentEditingRef = null;
let currentEditingGMModel = null;
let greyMarketData = [];
let modelNameSuggestions = [];

// --- Reference Lookup CRUD ---
function showAddReferenceForm() {
  currentEditingRef = null;
  document.getElementById('formTitle').innerText = 'Add New Reference';
  clearReferenceForm();
  document.getElementById('deleteButton').style.display = 'none';
  document.getElementById('refFormContainer').style.display = 'block';
  document.getElementById('results').innerHTML = '';
}
function showEditReferenceForm(data) {
  currentEditingRef = data.reference;
  document.getElementById('formTitle').innerText = 'Edit Reference';
  document.getElementById('ref_reference').value = data.reference || '';
  document.getElementById('ref_manufacturer').value = data.manufacturer || '';
  document.getElementById('ref_collection').value = data.collection || '';
  document.getElementById('ref_retail_price').value = data.retail_price || '';
  document.getElementById('ref_dial').value = data.dial || '';
  document.getElementById('ref_case').value = data.case || '';
  document.getElementById('ref_bracelet').value = data.bracelet || '';
  document.getElementById('ref_movement').value = data.movement || '';
  document.getElementById('ref_year_introduced').value = data.year_introduced || '';
  document.getElementById('ref_notes').value = data.notes || '';
  document.getElementById('ref_images').value = (data.images || []).join(', ');
  document.getElementById('deleteButton').style.display = 'inline-block';
  document.getElementById('refFormContainer').style.display = 'block';
  document.getElementById('results').innerHTML = '';
}
function clearReferenceForm() {
  [
    'ref_reference','ref_manufacturer','ref_collection','ref_retail_price','ref_dial',
    'ref_case','ref_bracelet','ref_movement','ref_year_introduced','ref_notes','ref_images'
  ].forEach(id => document.getElementById(id).value = '');
}
function cancelReferenceForm() {
  document.getElementById('refFormContainer').style.display = 'none';
}
async function saveReference() {
  const imagesRaw = document.getElementById('ref_images').value.trim();
  const images = imagesRaw ? imagesRaw.split(',').map(s => s.trim()) : [];
  const data = {
    reference: document.getElementById('ref_reference').value.trim(),
    manufacturer: document.getElementById('ref_manufacturer').value.trim(),
    collection: document.getElementById('ref_collection').value.trim(),
    retail_price: document.getElementById('ref_retail_price').value.trim(),
    dial: document.getElementById('ref_dial').value.trim(),
    case: document.getElementById('ref_case').value.trim(),
    bracelet: document.getElementById('ref_bracelet').value.trim(),
    movement: document.getElementById('ref_movement').value.trim(),
    year_introduced: document.getElementById('ref_year_introduced').value.trim(),
    notes: document.getElementById('ref_notes').value.trim(),
    images: images
  };
  if (!data.reference) {
    alert('Reference is required!');
    return;
  }
  try {
    let url = '/.netlify/functions/add';
    let method = 'POST';
    let body = JSON.stringify(data);
    if (currentEditingRef) {
      url = '/.netlify/functions/update';
      body = JSON.stringify({ reference: currentEditingRef, fields: data });
    }
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error('Network response was not ok');
    alert(currentEditingRef ? 'Reference updated' : 'Reference added');
    cancelReferenceForm();
    lookupReference();
  } catch (err) {
    alert('Error saving reference: ' + err.message);
    console.error(err);
  }
}
async function deleteReference() {
  if (!currentEditingRef) return;
  if (!confirm(`Are you sure you want to delete reference "${currentEditingRef}"?`)) return;
  try {
    const res = await fetch('/.netlify/functions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: currentEditingRef })
    });
    if (!res.ok) throw new Error('Network response was not ok');
    alert('Reference deleted');
    cancelReferenceForm();
    lookupReference();
  } catch (err) {
    alert('Error deleting reference: ' + err.message);
    console.error(err);
  }
}
async function lookupReference() {
  const ref = document.getElementById('refInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  if (!ref) {
    alert('Please enter a reference number.');
    return;
  }
  resultsDiv.innerHTML = '<div>Searching...</div>';
  try {
    const res = await fetch(`/.netlify/functions/lookup?ref=${encodeURIComponent(ref)}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      resultsDiv.innerHTML = `<div>No Reference matches found.</div><button onclick="showAddReferenceForm()">Add New Reference</button>`;
      return;
    }
    resultsDiv.innerHTML = data.map(item => {
      const imagesHtml = (item.images || []).map(filename => 
        `<img src="assets/${filename}" alt="${item.reference} image" class="watch-image" />`
      ).join('');
      return `
        <div class="card">
          <div class="card-images">${imagesHtml}</div>
          <div>
            <p class="manufacturer-line">${item.manufacturer || 'N/A'} — Ref: ${item.reference}</p>
            <p>Collection: ${item.collection || 'N/A'}</p>
            <p>Retail Price: ${item.retail_price || 'N/A'}</p>
            <p>Dial: ${item.dial || 'N/A'}</p>
            <p>Case: ${item.case || 'N/A'}</p>
            <p>Bracelet: ${item.bracelet || 'N/A'}</p>
            <p>Movement: ${item.movement || 'N/A'}</p>
            <p><strong>Notes:</strong> ${item.notes || ''}</p>
            <button onclick='showEditReferenceForm(${JSON.stringify(item).replace(/'/g, "\\'")})'>Edit</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    resultsDiv.innerHTML = `<div>Error fetching reference data.</div>`;
    console.error(err);
  }
}

// --- Grey Market CRUD & Autocomplete ---
async function fetchGreyMarketData() {
  try {
    const res = await fetch('/.netlify/functions/greyMarketLookup?reference=');
    if (!res.ok) throw new Error('Failed to fetch grey market data');
    greyMarketData = await res.json();
    const namesSet = new Set();
    greyMarketData.forEach(item => {
      if (item['Model Name']) namesSet.add(item['Model Name'].toUpperCase());
    });
    modelNameSuggestions = Array.from(namesSet).sort();
  } catch (e) {
    console.error('Error loading grey market data:', e);
  }
}
function clearGreyMarketForm() {
  [
    'gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname',
    'gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set',
    'gm_retail_ready','gm_current_retail','gm_dealer','gm_comments'
  ].forEach(id => {
    if(id !== 'gm_model_name')
      document.getElementById(id).value = '';
  });
  currentEditingGMModel = null;
  document.getElementById('gm_delete_button').style.display = 'none';
  hideRecordPicker();
}
function showAddGreyMarketForm() {
  document.getElementById('greyMarketFormTitle').innerText = 'Add New Grey Market Entry';
  clearGreyMarketForm();
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  document.getElementById('results').innerHTML = '';
}
function showEditGreyMarketForm(record) {
  currentEditingGMModel = record.Model;
  document.getElementById('greyMarketFormTitle').innerText = 'Edit Grey Market Entry';
  document.getElementById('greyMarketFormContainer').style.display = 'block';
  document.getElementById('gm_date_entered').value = record["Date Entered"] || '';
  document.getElementById('gm_year').value = record.Year || '';
  document.getElementById('gm_model').value = record.Model || '';
  document.getElementById('gm_model_name').value = record["Model Name"] || '';
  document.getElementById('gm_nickname').value = record["Nickname or Dial"] || '';
  document.getElementById('gm_bracelet').value = record.Bracelet || '';
  document.getElementById('gm_bracelet_metal_color').value = record["Bracelet Metal/Color"] || '';
  document.getElementById('gm_price').value = record.Price || '';
  document.getElementById('gm_full_set').value = record["Full Set"] || '';
  document.getElementById('gm_retail_ready').value = record["Retail Ready"] || '';
  document.getElementById('gm_current_retail').value = record["Current Retail (Not Inc Tax)"] || '';
  document.getElementById('gm_dealer').value = record.Dealer || '';
  document.getElementById('gm_comments').value = record.Comments || '';
  document.getElementById('gm_delete_button').style.display = 'inline-block';
}
function cancelGreyMarketForm() {
  document.getElementById('greyMarketFormContainer').style.display = 'none';
  hideRecordPicker();
}


const modelNameInput = document.getElementById('gm_model_name');
const recordPicker = document.getElementById('gmRecordPicker');

modelNameInput.addEventListener('input', function() {
  const val = this.value.trim().toUpperCase();
  if (!val) {
    hideRecordPicker();
    return;
  }
  const filteredNames = modelNameSuggestions.filter(name => name.startsWith(val));
  if (filteredNames.length === 0) {
    hideRecordPicker();
    return;
  }
  showRecordPickerWithList(filteredNames);
});

modelNameInput.addEventListener('blur', function() {
  // Delay hiding so clicks on picker register
  setTimeout(() => {
    hideRecordPicker();
  }, 150);
});

document.addEventListener('click', function(event) {
  if (!recordPicker.contains(event.target) && event.target !== modelNameInput) {
    hideRecordPicker();
  }
});

function showRecordPickerWithList(names) {
  recordPicker.innerHTML = '';
  const matchedRecords = [];
  names.forEach(name => {
    const recs = greyMarketData.filter(item => item['Model Name'] && item['Model Name'].toUpperCase() === name);
    matchedRecords.push(...recs);
  });
  if (matchedRecords.length === 0) {
    hideRecordPicker();
    return;
  }
  matchedRecords.forEach(record => {
    const div = document.createElement('div');
    div.textContent = `${record.Model} | ${record['Nickname or Dial'] || ''} | ${record.Bracelet || ''}`;
    div.addEventListener('mousedown', (e) => {
      // mousedown, not click, to avoid blur hiding picker before event fires
      e.preventDefault(); 
      autofillGreyMarketForm(record);
      hideRecordPicker();
    });
    recordPicker.appendChild(div);
  });
  recordPicker.style.display = 'block';
}

function hideRecordPicker() {
  recordPicker.style.display = 'none';
  recordPicker.innerHTML = '';
}


function showRecordPickerForModelName(modelName) {
  const matches = greyMarketData.filter(item => 
    item['Model Name'] && item['Model Name'].toUpperCase() === modelName.toUpperCase()
  );
  if (matches.length === 0) {
    hideRecordPicker();
    return;
  }
  recordPicker.innerHTML = '';
  matches.forEach(record => {
    const div = document.createElement('div');
    div.textContent = `${record.Model} | ${record['Nickname or Dial'] || ''} | ${record.Bracelet || ''}`;
    div.addEventListener('click', () => {
      autofillGreyMarketForm(record);
      hideRecordPicker();
    });
    recordPicker.appendChild(div);
  });
  recordPicker.style.display = 'block';
}
function hideRecordPicker() {
  recordPicker.style.display = 'none';
  recordPicker.innerHTML = '';
}
function autofillGreyMarketForm(record) {
  document.getElementById('gm_date_entered').value = '';
  document.getElementById('gm_year').value = '';
  document.getElementById('gm_price').value = '';
  document.getElementById('gm_full_set').value = '';
  document.getElementById('gm_retail_ready').value = '';
  document.getElementById('gm_dealer').value = '';
  document.getElementById('gm_comments').value = '';
  document.getElementById('gm_model').value = record.Model || '';
  document.getElementById('gm_model_name').value = record['Model Name'] || '';
  document.getElementById('gm_nickname').value = record['Nickname or Dial'] || '';
  document.getElementById('gm_bracelet').value = record.Bracelet || '';
  document.getElementById('gm_bracelet_metal_color').value = record['Bracelet Metal/Color'] || '';
  document.getElementById('gm_delete_button').style.display = 'inline-block';
  currentEditingGMModel = record.Model;
}

async function saveGreyMarketEntry() {
  const rawModelName = document.getElementById('gm_model_name').value.trim();
  const newModel = document.getElementById('gm_model').value.trim();

  const data = {
    "Date Entered": document.getElementById('gm_date_entered').value.trim(),
    "Year": document.getElementById('gm_year').value.trim(),
    "Model": newModel,
    "Model Name": rawModelName.toUpperCase(),
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

  if (!data.Model) {
    alert('Model is required!');
    return;
  }

  try {
    let url = '/.netlify/functions/addgreyMarket';
    let method = 'POST';
    let body = JSON.stringify(data);

    // Only update if editing existing and Model field is unchanged
    if (currentEditingGMModel && currentEditingGMModel === newModel) {
      url = '/.netlify/functions/updateGreyMarket';
      body = JSON.stringify({ Model: currentEditingGMModel, fields: data });
    } else {
      // Treat as new add if Model changed or not editing
      currentEditingGMModel = null;
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error('Network response was not ok');

    alert(currentEditingGMModel ? 'Grey Market entry updated' : 'Grey Market entry added');
    cancelGreyMarketForm();
    lookupGreyMarket();

  } catch (err) {
    alert('Error saving Grey Market entry: ' + err.message);
    console.error(err);
  }
}

async function deleteGreyMarketEntry() {
  if (!currentEditingGMModel) return;
  if (!confirm(`Are you sure you want to delete model "${currentEditingGMModel}"?`)) return;
  try {
    const res = await fetch('/.netlify/functions/deleteGreyMarket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Model: currentEditingGMModel })
    });
    if (!res.ok) throw new Error('Network response was not ok');
    alert('Grey Market entry deleted');
    cancelGreyMarketForm();
    lookupGreyMarket();
  } catch (err) {
    alert('Error deleting Grey Market entry: ' + err.message);
    console.error(err);
  }
}
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
    if (!Array.isArray(data) || data.length === 0) {
      resultsDiv.innerHTML = `<div>No Grey Market matches found.</div>`;
      return;
    }
    // Table headers and data-labels for mobile!
    const headers = [
      "Date Entered", "Year", "Model", "Model Name", "Nickname or Dial",
      "Bracelet", "Bracelet Metal/Color", "Price", "Full Set", "Retail Ready",
      "Current Retail", "Dealer", "Comments", "Actions"
    ];
    let html = `<table id="greyMarketTable">
      <thead><tr>
        ${headers.map((h,i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')}
      </tr></thead>
      <tbody>`;
    data.forEach(item => {
      html += `<tr>
        <td data-label="Date Entered">${item["Date Entered"] || ''}</td>
        <td data-label="Year">${item.Year || ''}</td>
        <td data-label="Model">${item.Model || ''}</td>
        <td data-label="Model Name">${item["Model Name"] || ''}</td>
        <td data-label="Nickname or Dial">${item["Nickname or Dial"] || ''}</td>
        <td data-label="Bracelet">${item.Bracelet || ''}</td>
        <td data-label="Bracelet Metal/Color">${item["Bracelet Metal/Color"] || ''}</td>
        <td data-label="Price">${item.Price || ''}</td>
        <td data-label="Full Set">${item["Full Set"] || ''}</td>
        <td data-label="Retail Ready">${item["Retail Ready"] || ''}</td>
        <td data-label="Current Retail">${item["Current Retail (Not Inc Tax)"] || ''}</td>
        <td data-label="Dealer">${item.Dealer || ''}</td>
        <td data-label="Comments">${item.Comments || ''}</td>
        <td data-label="Actions"><button onclick='showEditGreyMarketForm(${JSON.stringify(item).replace(/'/g, "\\'")})'>Edit</button></td>
      </tr>`;
    });
    html += `</tbody></table>`;
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
  let switching = true;
  let dir = "asc";
  let switchcount = 0;
  while (switching) {
    switching = false;
    const rows = table.rows;
    let shouldSwitch;
    let i = 1;
    for (; i < (rows.length - 1); i++) {
      shouldSwitch = false;
      let x = rows[i].getElementsByTagName("TD")[n];
      let y = rows[i + 1].getElementsByTagName("TD")[n];
      if (dir === "asc") {
        if ((x.textContent || x.innerText).toLowerCase() > (y.textContent || y.innerText).toLowerCase()) {
          shouldSwitch = true;
          break;
        }
      } else if (dir === "desc") {
        if ((x.textContent || x.innerText).toLowerCase() < (y.textContent || y.innerText).toLowerCase()) {
          shouldSwitch = true;
          break;
        }
      }
    }
    if (shouldSwitch) {
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
      switchcount++;
    } else {
      if (switchcount === 0 && dir === "asc") {
        dir = "desc";
        switching = true;
      }
    }
  }
}

// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

// --- Expose edit functions and sortTable globally (for inline handlers) ---
window.showEditReferenceForm = showEditReferenceForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.sortTable = sortTable;
