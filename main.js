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
      const imagesHtml = (item.images || []).map(fn => `<img src="assets/${fn}" class="watch-image" />`).join('');
      return `
        <div class="card">
          <div class="card-images">${imagesHtml}</div>
          <div>
            <p class="manufacturer-line">${item.manufacturer} — Ref: ${item.reference}</p>
            <p>Collection: ${item.collection}</p>
            <p>Retail Price: ${item.retail_price}</p>
            <p>Dial: ${item.dial}</p>
            <p>Case: ${item.case}</p>
            <p>Bracelet: ${item.bracelet}</p>
            <p>Movement: ${item.movement}</p>
            <p><strong>Notes:</strong> ${item.notes}</p>
            <button onclick='showEditReferenceForm(${JSON.stringify(item).replace(/'/g,"\\'")})'>Edit</button>
          </div>
        </div>`;
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
    const names = [...new Set(greyMarketData.map(i => i['Model Name']).filter(Boolean).map(n => n.toUpperCase()))];
    modelNameSuggestions = names.sort();
  } catch (e) {
    console.error('Error loading grey market data:', e);
  }
}
function clearGreyMarketForm() {
  const ids = ['gm_date_entered','gm_year','gm_model','gm_model_name','gm_nickname','gm_bracelet','gm_bracelet_metal_color','gm_price','gm_full_set','gm_retail_ready','gm_current_retail','gm_dealer','gm_comments'];
  ids.forEach(id => { if (id !== 'gm_model_name') document.getElementById(id).value = ''; });
  currentEditingGMModel = null;
  document.getElementById('gm_delete_button').style.display = 'none';
  hideRecordPicker();
}
function showAddGreyMarketForm() { /* unchanged */ }
function showEditGreyMarketForm(record) { /* unchanged */ }
function cancelGreyMarketForm() { /* unchanged */ }

// Autocomplete functions unchanged...

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
              <p><strong>${item.Model}</strong></p>
              <p>Date Entered: ${item["Date Entered"]}</p>
              <p>Year: ${item.Year}</p>
              <p>Model Name: ${item["Model Name"]}</p>
              <p>Nickname/Dial: ${item["Nickname or Dial"]}</p>
              <p>Bracelet: ${item.Bracelet}</p>
              <p>Bracelet Metal/Color: ${item["Bracelet Metal/Color"]}</p>
              <p>Full Set: ${item["Full Set"]}</p>
              <p>Retail Ready: ${item["Retail Ready"]}</p>
              <p>Current Retail: ${item["Current Retail (Not Inc Tax)"]}</p>
              <p>Dealer: ${item.Dealer}</p>
              <p>Comments: ${item.Comments}</p>
              <button onclick='showEditGreyMarketForm(${JSON.stringify(item).replace(/'/g,"\\'")})'>Edit</button>
            </div>
          </div>`;
      }).join('');
    } else {
      // Mobile: existing table layout
      const headers = [
        "Date Entered","Year","Model","Model Name","Nickname or Dial",
        "Bracelet","Bracelet Metal/Color","Price","Full Set","Retail Ready",
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
          <td data-label="Price">${item.Price||''}</td>
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

// --- DOMContentLoaded ---
window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

// --- Expose for inline handlers ---
window.showEditReferenceForm = showEditReferenceForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.sortTable = sortTable;
window.saveGreyMarketEntry = saveGreyMarketEntry;
