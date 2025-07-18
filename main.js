// --- Grey Market CRUD & Autocomplete ---
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;
let currentEditingGMUniqueId = null; // <-- This is what matters!

// Date helper for YYYY-MM-DD conversion and logging
function toDateInputValue(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d)) {
    console.log('Invalid date value received:', dateString);
    return '';
  }
  return d.toISOString().split('T')[0];
}
window.toDateInputValue = toDateInputValue;

// Fetch grey market data
async function fetchGreyMarketData() {
  try {
    const res = await fetch('/.netlify/functions/greyMarketLookup?reference');
    greyMarketData = await res.json();
  } catch (e) {
    console.error("Failed to fetch grey market data:", e);
    greyMarketData = [];
  }
}

// Grey Market Lookup
async function lookupGreyMarket() {
  const input = document.getElementById('greyMarketInput').value.trim();
  if (!input) {
    document.getElementById('results').innerHTML = "";
    return;
  }
  await fetchGreyMarketData();
  const matches = greyMarketData.filter(row =>
    row.Model?.toLowerCase().includes(input.toLowerCase()) ||
    row["Model Name"]?.toLowerCase().includes(input.toLowerCase())
  );

  if (matches.length === 0) {
    document.getElementById('results').innerHTML = "<p>No matches found.</p>";
    return;
  }

  let resultsHTML = '<table class="gm-table"><tr>' +
    '<th>Date Entered</th>' +
    '<th>Year</th>' +
    '<th>Model</th>' +
    '<th>Model Name</th>' +
    '<th>Nickname or Dial</th>' +
    '<th>Bracelet</th>' +
    '<th>Bracelet Metal/Color</th>' +
    '<th>Grey Market Price</th>' +
    '<th>Full Set</th>' +
    '<th>Retail Ready</th>' +
    '<th>Current Retail (Not Inc Tax)</th>' +
    '<th>Dealer</th>' +
    '<th>Image</th>' +
    '<th>Comments</th>' +
    '<th>Edit</th>' +
    '</tr>';
  matches.forEach(row => {
    resultsHTML += '<tr>' +
      `<td>${row["Date Entered"] || ""}</td>` +
      `<td>${row["Year"] || ""}</td>` +
      `<td>${row["Model"] || ""}</td>` +
      `<td>${row["Model Name"] || ""}</td>` +
      `<td>${row["Nickname or Dial"] || ""}</td>` +
      `<td>${row["Bracelet"] || ""}</td>` +
      `<td>${row["Bracelet Metal/Color"] || ""}</td>` +
      `<td>${row["Price"] || ""}</td>` +
      `<td>${row["Full Set"] || ""}</td>` +
      `<td>${row["Retail Ready"] || ""}</td>` +
      `<td>${row["Current Retail (Not Inc Tax)"] || ""}</td>` +
      `<td>${row["Dealer"] || ""}</td>` +
      `<td>${row.Image ? `<img src="${row.Image}" style="max-width:60px;cursor:pointer;" onclick="showImgModal('${row.Image}')"/>` : ""}</td>` +
      `<td>${row["Comments"] || ""}</td>` +
      `<td><button onclick="editGreyMarketEntry('${row.uniqueId}')">Edit</button></td>` +
      '</tr>';
  });
  resultsHTML += '</table>';
  document.getElementById('results').innerHTML = resultsHTML;
}

// Edit function with date fix & logs
function editGreyMarketEntry(uniqueId) {
  const entry = greyMarketData.find((row) => row.uniqueId === uniqueId);
  if (!entry) {
    console.log('No entry found for uniqueId:', uniqueId);
    return;
  }

  console.log('Editing entry:', entry);

  showEditGreyMarketForm();

  // Date fix with log
  const dateValue = toDateInputValue(entry["Date Entered"]);
  console.log('Setting gm_date_entered to:', dateValue);
  document.getElementById("gm_date_entered").value = dateValue;

  document.getElementById("gm_year").value = entry["Year"] || "";
  document.getElementById("gm_model").value = entry["Model"] || "";
  document.getElementById("gm_model_name").value = entry["Model Name"] || "";
  document.getElementById("gm_nickname").value = entry["Nickname or Dial"] || "";
  document.getElementById("gm_bracelet").value = entry["Bracelet"] || "";
  document.getElementById("gm_bracelet_metal_color").value = entry["Bracelet Metal/Color"] || "";
  document.getElementById("gm_price").value = entry["Price"] || "";
  document.getElementById("gm_full_set").value = entry["Full Set"] || "";
  document.getElementById("gm_retail_ready").value = entry["Retail Ready"] || "";
  document.getElementById("gm_current_retail").value = entry["Current Retail (Not Inc Tax)"] || "";
  document.getElementById("gm_dealer").value = entry["Dealer"] || "";
  document.getElementById("gm_comments").value = entry["Comments"] || "";

  if (entry.Image) {
    document.getElementById("gm_current_img").src = entry.Image;
    document.getElementById("gm_current_img").style.display = "block";
  } else {
    document.getElementById("gm_current_img").src = "";
    document.getElementById("gm_current_img").style.display = "none";
  }

  currentEditingGMUniqueId = uniqueId;
  document.getElementById("gm_delete_button").style.display = "block";
}
window.editGreyMarketEntry = editGreyMarketEntry;

// Show image modal
function showImgModal(imgUrl) {
  document.getElementById('imgModalImg').src = imgUrl;
  document.getElementById('imgModal').style.display = 'flex';
}

document.getElementById('imgModal').onclick = function (e) {
  if (e.target.id === "imgModal" || e.target.id === "imgModalImg") {
    document.getElementById('imgModal').style.display = 'none';
  }
};

// Show/Hide Add/Edit Grey Market Form
function showAddGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById("greyMarketFormTitle").textContent = "Add New Grey Market Entry";
  document.getElementById("greyMarketFormContainer").style.display = "block";
  document.getElementById("gm_delete_button").style.display = "none";
  currentEditingGMModel = null;
  currentEditingGMUniqueId = null;
}

function showEditGreyMarketForm() {
  document.getElementById("greyMarketFormTitle").textContent = "Edit Grey Market Entry";
  document.getElementById("greyMarketFormContainer").style.display = "block";
}

// Cancel/Add/Edit Grey Market Form
function cancelGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById("greyMarketFormContainer").style.display = "none";
}

function clearGreyMarketForm() {
  document.getElementById("gm_date_entered").value = "";
  document.getElementById("gm_year").value = "";
  document.getElementById("gm_model").value = "";
  document.getElementById("gm_model_name").value = "";
  document.getElementById("gm_nickname").value = "";
  document.getElementById("gm_bracelet").value = "";
  document.getElementById("gm_bracelet_metal_color").value = "";
  document.getElementById("gm_price").value = "";
  document.getElementById("gm_full_set").value = "";
  document.getElementById("gm_retail_ready").value = "";
  document.getElementById("gm_current_retail").value = "";
  document.getElementById("gm_dealer").value = "";
  document.getElementById("gm_comments").value = "";
  document.getElementById("gm_image").value = "";
  document.getElementById("gm_current_img").src = "";
  document.getElementById("gm_current_img").style.display = "none";
}

// Autocomplete for Model Name
document.getElementById("gm_model_name").addEventListener("input", function (e) {
  const val = e.target.value.trim().toLowerCase();
  if (!val) {
    modelNameSuggestions = [];
    document.getElementById("gmRecordPicker").style.display = "none";
    return;
  }
  modelNameSuggestions = greyMarketData.filter(row =>
    row["Model Name"]?.toLowerCase().includes(val)
  );
  if (modelNameSuggestions.length === 0) {
    document.getElementById("gmRecordPicker").style.display = "none";
    return;
  }
  let html = '';
  modelNameSuggestions.slice(0, 8).forEach(row => {
    html += `<div class="picker-item" onclick="selectGMModelName('${row["Model Name"]}', '${row["Model"]}')">${row["Model Name"]} (${row["Model"]})</div>`;
  });
  document.getElementById("gmRecordPicker").innerHTML = html;
  document.getElementById("gmRecordPicker").style.display = "block";
});

window.selectGMModelName = function (modelName, model) {
  document.getElementById("gm_model_name").value = modelName;
  document.getElementById("gm_model").value = model;
  document.getElementById("gmRecordPicker").style.display = "none";
};

// Hide autocomplete on blur
document.getElementById("gm_model_name").addEventListener("blur", function () {
  setTimeout(() => {
    document.getElementById("gmRecordPicker").style.display = "none";
  }, 150);
});

window.onload = function () {
  fetchGreyMarketData();
};


// --- Expose for inline handlers ---
window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
window.sortTable = sortTable;
