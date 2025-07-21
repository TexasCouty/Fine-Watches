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

  const postBody = {
    uniqueId,
    fields
  };

  console.log('--- Save Entry Debug ---');
  console.log('Unique ID field value:', uniqueId);
  console.log('Fields object:', fields);
  console.log('Post body to backend:', postBody);

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
      lookupGreyMarket();
    } else {
      alert('Error: ' + (result.error || 'Could not update entry'));
    }
  } catch (e) {
    alert('Network or server error');
    console.error(e);
  }
}

function parseDate(d) {
  if (!d) return new Date(0);
  if (d instanceof Date) return d;
  let parts = d.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      let [a, b, c] = parts.map(Number);
      if (a > 12) return new Date(c, b - 1, a);
      return new Date(c, a - 1, b);
    } else if (parts[0].length === 4) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  return new Date(d);
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
    data.sort((a, b) => parseDate(b["Date Entered"]) - parseDate(a["Date Entered"]));
    if (!data.length) {
      resultsDiv.innerHTML = '<div>No Grey Market matches found.</div>';
    } else {
      renderGreyMarketResults(data);
    }
  } catch (err) {
    resultsDiv.innerHTML = `<div>Error fetching grey market data.</div>`;
    console.error(err);
  }
  // Always clear fields and blur on any result
  document.getElementById('greyMarketInput').value = '';
  document.getElementById('nicknameDialInput').value = '';
  document.getElementById('greyMarketInput').blur();
  document.getElementById('nicknameDialInput').blur();
}

async function lookupGreyMarketByNicknameDial() {
  const input = document.getElementById('nicknameDialInput').value.trim();
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  if (!input) {
    alert('Enter a nickname or dial.');
    return;
  }
  resultsDiv.innerHTML = '<div>Searching Grey Market by Nickname/Dial...</div>';
  try {
    const res = await fetch(`/.netlify/functions/greyMarketLookup?nickname_or_dial=${encodeURIComponent(input)}`);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    data.sort((a, b) => parseDate(b["Date Entered"]) - parseDate(a["Date Entered"]));
    if (!data.length) {
      resultsDiv.innerHTML = '<div>No Grey Market matches found.</div>';
    } else {
      renderGreyMarketResults(data);
    }
  } catch (err) {
    resultsDiv.innerHTML = `<div>Error fetching grey market data.</div>`;
    console.error(err);
  }
  // Always clear fields and blur on any result
  document.getElementById('nicknameDialInput').value = '';
  document.getElementById('greyMarketInput').value = '';
  document.getElementById('nicknameDialInput').blur();
  document.getElementById('greyMarketInput').blur();
}



function renderGreyMarketResults(data) {
  const resultsDiv = document.getElementById('results');
  let html = '';
  if (window.innerWidth >= 768) {
    html = data.map(item => {
      let imgSrc = '';
      if (item.ImageFilename && item.ImageFilename.startsWith('http')) {
        imgSrc = item.ImageFilename;
      } else if (item.ImageFilename) {
        imgSrc = 'assets/grey_market/' + item.ImageFilename;
      }
      const img = imgSrc
        ? `<img src="${imgSrc}" class="enlargeable-img" style="max-width:200px; margin-right:20px; border-radius:8px; cursor:pointer;" onerror="this.style.display='none';" />`
        : '';
      return `
        <div class="card" style="display:flex;gap:20px;padding:15px;margin-bottom:20px;border:1px solid gold;border-radius:10px;">
          ${img}
          <div>
            <p><strong>Unique ID:</strong> ${item["Unique ID"] || item["uniqueId"] || ''}</p>
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
    const headers = [
      "Unique ID","Date Entered","Year","Model","Model Name","Nickname or Dial",
      "Bracelet","Bracelet Metal/Color","Grey Market Price","Full Set","Retail Ready",
      "Current Retail","Dealer","Comments","Actions"
    ];
    html = `<table id="greyMarketTable"><thead><tr>${
      headers.map((h,i) => `<th onclick="sortTable(${i})">${h}</th>`).join('')
    }</tr></thead><tbody>`;
    data.forEach(item => {
      let imgSrc = '';
      if (item.ImageFilename && item.ImageFilename.startsWith('http')) {
        imgSrc = item.ImageFilename;
      } else if (item.ImageFilename) {
        imgSrc = 'assets/grey_market/' + item.ImageFilename;
      }
      html += `<tr>
        <td data-label="Unique ID">${item["Unique ID"] || item["uniqueId"] || ""}</td>
        <td data-label="Date Entered">${item["Date Entered"]||''}</td>
        <td data-label="Year">${item.Year||''}</td>
        <td data-label="Model">${item.Model||''}${
          imgSrc
            ? `<br><img src="${imgSrc}" class="enlargeable-img" style="max-width:120px;margin-top:5px;cursor:pointer;" onerror="this.style.display='none';">`
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
  addImageModalHandlers();
}

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

function hideRecordPicker() {
  const picker = document.getElementById('gmRecordPicker');
  if (picker) picker.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('imgModal');
  const modalImg = document.getElementById('imgModalImg');
  if (modal && modalImg) {
    modal.onclick = () => modal.style.display = 'none';
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') modal.style.display = 'none';
    });
  }
});

function addImageModalHandlers() {
  document.querySelectorAll('.enlargeable-img').forEach(img => {
    img.onclick = function(e) {
      e.stopPropagation();
      const modal = document.getElementById('imgModal');
      const modalImg = document.getElementById('imgModalImg');
      if (modal && modalImg) {
        modalImg.src = this.src;
        modal.style.display = 'flex';
      }
    };
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await fetchGreyMarketData();
});

window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
window.sortTable = sortTable;
window.lookupGreyMarketByNicknameDial = lookupGreyMarketByNicknameDial; // <--- Make available globally
