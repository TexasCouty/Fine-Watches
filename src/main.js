// src/main.js
// ==========================
// Debug Netlify env (will be undefined in the browser)
// ==========================
console.log(
  "🚨 Netlify ENV MONGO_URI:",
  typeof process !== "undefined" ? process.env?.MONGO_URI : "<no process>"
);

// ==========================
// Data & state
// ==========================
let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;

// ==========================
// Date helper for date inputs
// ==========================
function toDateInputValue(dateString) {
  if (!dateString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = new Date(dateString);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

// ==========================
// Fetch for autocomplete (optional)
// ==========================
async function fetchGreyMarketData() {
  try {
    const res = await fetch("/.netlify/functions/greyMarketLookup?term=");
    console.log("[Init] fetchGreyMarketData status →", res.status);
    if (!res.ok) throw new Error("Failed to fetch grey market data");
    greyMarketData = await res.json();
    const names = [
      ...new Set(
        greyMarketData
          .map((i) => i["Model Name"])
          .filter(Boolean)
          .map((n) => n.toUpperCase())
      ),
    ];
    modelNameSuggestions = names.sort();
  } catch (e) {
    console.error("Error loading grey market data:", e);
  }
}

// ==========================
// Form show / hide / clear
// ==========================
function clearGreyMarketForm() {
  const ids = [
    "gm_unique_id",
    "gm_date_entered",
    "gm_year",
    "gm_model",
    "gm_model_name",
    "gm_nickname",
    "gm_bracelet",
    "gm_bracelet_metal_color",
    "gm_price",
    "gm_full_set",
    "gm_retail_ready",
    "gm_current_retail",
    "gm_dealer",
    "gm_comments",
  ];
  ids.forEach((id) => {
    if (id !== "gm_model_name") document.getElementById(id).value = "";
  });
  currentEditingGMModel = null;
  document.getElementById("gm_delete_button").style.display = "none";
  hideRecordPicker();
  document.getElementById("greyMarketFormContainer").style.display = "none";
}

function showAddGreyMarketForm() {
  clearGreyMarketForm();
  document.getElementById("greyMarketFormTitle").innerText =
    "Add New Grey Market Entry";
  document.getElementById("greyMarketFormContainer").style.display = "block";
  document.getElementById("gm_delete_button").style.display = "none";
}

function showEditGreyMarketForm(record) {
  document.getElementById("greyMarketFormTitle").innerText =
    "Edit Grey Market Entry";
  document.getElementById("greyMarketFormContainer").style.display = "block";
  document.getElementById("gm_unique_id").value =
    record["Unique ID"] || record.uniqueId || "";
  document.getElementById("gm_date_entered").value = toDateInputValue(
    record["Date Entered"]
  );
  document.getElementById("gm_year").value = record["Year"] || "";
  document.getElementById("gm_model").value = record["Model"] || "";
  document.getElementById("gm_model_name").value =
    record["Model Name"] || "";
  document.getElementById("gm_nickname").value =
    record["Nickname or Dial"] || "";
  document.getElementById("gm_bracelet").value = record["Bracelet"] || "";
  document.getElementById("gm_bracelet_metal_color").value =
    record["Bracelet Metal/Color"] || "";
  document.getElementById("gm_price").value = record["Price"] || "";
  document.getElementById("gm_full_set").value = record["Full Set"] || "";
  document.getElementById("gm_retail_ready").value =
    record["Retail Ready"] || "";
  document.getElementById("gm_current_retail").value =
    record["Current Retail (Not Inc Tax)"] || "";
  document.getElementById("gm_dealer").value = record["Dealer"] || "";
  document.getElementById("gm_comments").value = record["Comments"] || "";

  currentEditingGMModel = record["Model"];
  document.getElementById("gm_delete_button").style.display = "inline-block";

  // Image display
  const imgEl = document.getElementById("gm_current_img");
  if (record.ImageFilename) {
    const src = record.ImageFilename.startsWith("http")
      ? record.ImageFilename
      : "assets/grey_market/" + record.ImageFilename;
    imgEl.src = src;
    imgEl.style.display = "block";
  } else {
    imgEl.src = "";
    imgEl.style.display = "none";
  }
}

function cancelGreyMarketForm() {
  clearGreyMarketForm();
}

// ==========================
// Save Entry (unchanged)
// ==========================
async function saveGreyMarketEntry() {
  const Model = document.getElementById("gm_model").value.trim();
  const fields = {
    "Unique ID": document.getElementById("gm_unique_id").value.trim(),
    "Date Entered": document.getElementById("gm_date_entered").value.trim(),
    Year: document.getElementById("gm_year").value.trim(),
    Model,
    "Model Name": document.getElementById("gm_model_name").value.trim(),
    "Nickname or Dial": document.getElementById("gm_nickname").value.trim(),
    Bracelet: document.getElementById("gm_bracelet").value.trim(),
    "Bracelet Metal/Color": document
      .getElementById("gm_bracelet_metal_color")
      .value.trim(),
    Price: document.getElementById("gm_price").value.trim(),
    "Full Set": document.getElementById("gm_full_set").value.trim(),
    "Retail Ready": document.getElementById("gm_retail_ready").value.trim(),
    "Current Retail (Not Inc Tax)": document
      .getElementById("gm_current_retail")
      .value.trim(),
    Dealer: document.getElementById("gm_dealer").value.trim(),
    Comments: document.getElementById("gm_comments").value.trim(),
  };

  const uniqueId = fields["Unique ID"];
  const imageInput = document.getElementById("gm_image");
  let imageUrl = "";
  if (imageInput && imageInput.files && imageInput.files[0]) {
    const data = new FormData();
    data.append("file", imageInput.files[0]);
    data.append("upload_preset", "unsigned_preset");
    const cloudName = "dnymcygtl";
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: data }
    );
    const imgData = await res.json();
    imageUrl = imgData.secure_url;
    const imgEl = document.getElementById("gm_current_img");
    imgEl.src = imageUrl;
    imgEl.style.display = "block";
  } else {
    const imgEl = document.getElementById("gm_current_img");
    imageUrl = imgEl.src || "";
  }
  fields.ImageFilename = imageUrl;

  const modelKey = currentEditingGMModel || Model;
  if (!modelKey) {
    alert("Model is required.");
    return;
  }

  const postBody = { uniqueId, fields };
  console.log("--- Save Entry Debug ---", postBody);

  try {
    const res = await fetch("/.netlify/functions/updateGreyMarket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postBody),
    });
    const result = await res.json();
    if (res.ok) {
      alert("Entry updated!");
      clearGreyMarketForm();
      lookupCombinedGreyMarket();
    } else {
      alert("Error: " + (result.error || "Could not update entry"));
    }
  } catch (e) {
    alert("Network or server error");
    console.error(e);
  }
}

// ==========================
// Unified Search + logging + client-side sort
// ==========================
async function lookupCombinedGreyMarket() {
  const term = document.getElementById("combinedSearchInput").value.trim();
  console.log("[Unified Search] input term →", term);
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";

  if (!term) {
    alert("Enter Model, Model Name, or Nickname/Dial");
    return;
  }
  resultsDiv.innerHTML = "<div>Searching Grey Market…</div>";

  try {
    const res = await fetch(
      `/.netlify/functions/greyMarketLookup?term=${encodeURIComponent(term)}`
    );
    console.log("[Unified Search] fetch status →", res.status);
    const data = await res.json();
    console.log("[Unified Search] raw data →", data);

    // client-side sort: newest → oldest by Date Entered
    data.sort(
      (a, b) => new Date(b["Date Entered"]) - new Date(a["Date Entered"])
    );

    if (!Array.isArray(data)) {
      console.error("Unexpected response format:", data);
      resultsDiv.innerHTML = "<div>Error: invalid response</div>";
      return;
    }

    console.log("[Unified Search] Found", data.length, "results after sort");
    if (data.length === 0) {
      resultsDiv.innerHTML = "<div>No Grey Market matches found.</div>";
    } else {
      renderGreyMarketResults(data);
    }
  } catch (err) {
    console.error("[Unified Search] Fetch error:", err);
    resultsDiv.innerHTML = "<div>Error fetching grey market data.</div>";
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

// ==========================
// Render results
// ==========================
function renderGreyMarketResults(data) {
  const resultsDiv = document.getElementById("results");
  let html = "";

  // desktop cards
  if (window.innerWidth >= 768) {
    html = data
      .map((item) => {
        const imgSrc =
          item.ImageFilename && item.ImageFilename.startsWith("http")
            ? item.ImageFilename
            : item.ImageFilename
            ? `assets/grey_market/${item.ImageFilename}`
            : "";
        const imgTag = imgSrc
          ? `<img src="${imgSrc}" class="enlargeable-img" style="max-width:200px;margin-right:20px;border-radius:8px;cursor:pointer;" onerror="this.style.display='none';" />`
          : "";
        return `
          <div class="card" style="display:flex;gap:20px;padding:15px;margin-bottom:20px;border:1px solid gold;border-radius:10px;">
            ${imgTag}
            <div>
              <p><strong>Unique ID:</strong> ${item["Unique ID"] ||
                item.uniqueId ||
                ""}</p>
              <p><strong>Model:</strong> ${item.Model}</p>
              <p><strong>Date Entered:</strong> ${item["Date Entered"]}</p>
              <p><strong>Year:</strong> ${item.Year}</p>
              <p><strong>Model Name:</strong> ${item["Model Name"]}</p>
              <p><strong>Nickname/Dial:</strong> ${item["Nickname or Dial"]}</p>
              <p><strong>Bracelet:</strong> ${item.Bracelet}</p>
              <p><strong>Bracelet Metal/Color:</strong> ${
                item["Bracelet Metal/Color"]
              }</p>
              <p><strong>Full Set:</strong> ${item["Full Set"]}</p>
              <p><strong>Retail Ready:</strong> ${item["Retail Ready"]}</p>
              <p><strong>Grey Market Price:</strong> ${item.Price || ""}</p>
              <p><strong>Current Retail:</strong> ${
                item["Current Retail (Not Inc Tax)"]
              }</p>
              <p><strong>Dealer:</strong> ${item.Dealer}</p>
              <p><strong>Comments:</strong> ${item.Comments}</p>
              <button onclick='showEditGreyMarketForm(${JSON.stringify(
                item
              ).replace(/'/g, "\\'")})'>Edit</button>
            </div>
          </div>`;
      })
      .join("");
  } else {
    // mobile table
    html = `<table id="greyMarketTable"><thead><tr>${
      [
        "Unique ID",
        "Date Entered",
        "Year",
        "Model",
        "Model Name",
        "Nickname or Dial",
        "Bracelet",
        "Bracelet Metal/Color",
        "Grey Market Price",
        "Full Set",
        "Retail Ready",
        "Current Retail",
        "Dealer",
        "Comments",
        "Actions",
      ]
        .map((h, i) => `<th onclick="sortTable(${i})">${h}</th>`)
        .join("")
    }</tr></thead><tbody>`;
    data.forEach((item) => {
      const imgSrc =
        item.ImageFilename && item.ImageFilename.startsWith("http")
          ? item.ImageFilename
          : item.ImageFilename
          ? `assets/grey_market/${item.ImageFilename}`
          : "";
      const imgTag = imgSrc
        ? `<br><img src="${imgSrc}" class="enlargeable-img" style="max-width:120px;margin-top:5px;cursor:pointer;" onerror="this.style.display='none';">`
        : "";
      html += `<tr>
        <td data-label="Unique ID">${item["Unique ID"] ||
          item.uniqueId ||
          ""}</td>
        <td data-label="Date Entered">${item["Date Entered"] || ""}</td>
        <td data-label="Year">${item.Year || ""}</td>
        <td data-label="Model">${item.Model || ""}${imgTag}</td>
        <td data-label="Model Name">${item["Model Name"] || ""}</td>
        <td data-label="Nickname or Dial">${
          item["Nickname or Dial"] || ""
        }</td>
        <td data-label="Bracelet">${item.Bracelet || ""}</td>
        <td data-label="Bracelet Metal/Color">${
          item["Bracelet Metal/Color"] || ""
        }</td>
        <td data-label="Grey Market Price">${item.Price || ""}</td>
        <td data-label="Full Set">${item["Full Set"] || ""}</td>
        <td data-label="Retail Ready">${item["Retail Ready"] || ""}</td>
        <td data-label="Current Retail">${item["Current Retail (Not Inc Tax)"] ||
          ""}</td>
        <td data-label="Dealer">${item.Dealer || ""}</td>
        <td data-label="Comments">${item.Comments || ""}</td>
        <td data-label="Actions">
          <button onclick='showEditGreyMarketForm(${JSON.stringify(
            item
          ).replace(/'/g, "\\'")})'>Edit</button>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  resultsDiv.innerHTML = html;
  addImageModalHandlers();
}

// ==========================
// Table sorting (unchanged)
// ==========================
function sortTable(n) {
  const table = document.getElementById("greyMarketTable");
  if (!table) return;
  let switching = true,
    dir = "asc",
    switchcount = 0;
  while (switching) {
    switching = false;
    const rows = table.rows;
    for (let i = 1; i < rows.length - 1; i++) {
      let shouldSwitch = false;
      const x = rows[i].getElementsByTagName("TD")[n];
      const y = rows[i + 1].getElementsByTagName("TD")[n];
      if (
        (dir === "asc" &&
          x.innerText.toLowerCase() > y.innerText.toLowerCase()) ||
        (dir === "desc" &&
          x.innerText.toLowerCase() < y.innerText.toLowerCase())
      ) {
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

// ==========================
// Hide autocomplete picker
// ==========================
function hideRecordPicker() {
  const picker = document.getElementById("gmRecordPicker");
  if (picker) picker.style.display = "none";
}

// ==========================
// Image modal handlers
// ==========================
function addImageModalHandlers() {
  document.querySelectorAll(".enlargeable-img").forEach((img) => {
    img.onclick = function (e) {
      e.stopPropagation();
      const modal = document.getElementById("imgModal");
      modal.style.display = "flex";
      document.getElementById("imgModalImg").src = this.src;
    };
  });
  const modal = document.getElementById("imgModal");
  modal.onclick = () => (modal.style.display = "none");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.style.display = "none";
  });
}

// ==========================
// On load
// ==========================
window.addEventListener("DOMContentLoaded", async () => {
  await fetchGreyMarketData();
});

// Expose form handlers
window.showAddGreyMarketForm = showAddGreyMarketForm;
window.showEditGreyMarketForm = showEditGreyMarketForm;
window.cancelGreyMarketForm = cancelGreyMarketForm;
window.saveGreyMarketEntry = saveGreyMarketEntry;
