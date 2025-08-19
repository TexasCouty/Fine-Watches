// src/main.js
// Updated Grey Market UI: single full-width detail dock below top cards
// Based on your restored files. See style.css for .detail-dock styles.

console.log("[main] main.js loaded");

let greyMarketData = [];
let modelNameSuggestions = [];
let currentEditingGMModel = null;

// Date helper
function toDateInputValue(dateString) {
  if (!dateString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString;
  const d = new Date(dateString);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

// Fetch (initial optional)
async function fetchGreyMarketData() {
  try {
    const res = await fetch("/.netlify/functions/greyMarketLookup?term=");
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
    console.warn("[init] Couldn't prefetch grey market data:", e);
  }
}

// Basic form helpers (kept from your version)
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
    if (document.getElementById(id)) document.getElementById(id).value = "";
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
  document.getElementById("gm_model_name").value = record["Model Name"] || "";
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

async function saveGreyMarketEntry() {
  // (keep same save flow as you had)
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
      // refresh results if any
      document.getElementById("gmSearchBtn").click();
    } else {
      alert("Error: " + (result.error || "Could not update entry"));
    }
  } catch (e) {
    alert("Network or server error");
    console.error(e);
  }
}

// ---------- CORE: unified search ----------------
async function lookupCombinedGreyMarket() {
  const termEl = document.getElementById("combinedSearchInput");
  const term = termEl.value.trim();
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
    const data = await res.json();

    // client-side sort: newest → oldest by Date Entered
    data.sort(
      (a, b) => new Date(b["Date Entered"] || 0) - new Date(a["Date Entered"] || 0)
    );

    if (!Array.isArray(data)) {
      resultsDiv.innerHTML = "<div>Error: invalid response</div>";
      return;
    }

    greyMarketData = data;
    renderGreyMarketResults(greyMarketData);

    // Clear the search field for fast subsequent searches
    termEl.value = "";

    // Auto-select first result and render its detail
    if (greyMarketData.length > 0) {
      renderDetailCard(greyMarketData[0]);
      // highlight row 0
      highlightResultRow(0);
    } else {
      clearDetailDock();
    }
  } catch (err) {
    console.error("[Unified Search] Fetch error:", err);
    resultsDiv.innerHTML = "<div>Error fetching grey market data.</div>";
  }
}
window.lookupCombinedGreyMarket = lookupCombinedGreyMarket;

// Attach search button
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("gmSearchBtn").addEventListener("click", lookupCombinedGreyMarket);
  document.getElementById("openAddBtn").addEventListener("click", showAddGreyMarketForm);
  document.getElementById("saveGmBtn").addEventListener("click", saveGreyMarketEntry);
  document.getElementById("cancelGmBtn").addEventListener("click", cancelGreyMarketForm);
  fetchGreyMarketData().catch(() => {});
});

// ---------- render list of results (click to show detail) ----------
function renderGreyMarketResults(data) {
  const resultsDiv = document.getElementById("results");
  if (!data || data.length === 0) {
    resultsDiv.innerHTML = "<div>No Grey Market matches found.</div>";
    return;
  }

  // Build a compact table/list for desktop; single-column list for mobile
  let html = "";
  if (window.innerWidth >= 768) {
    html += '<div class="tablewrap"><table id="gmResultsTable"><thead><tr><th>Model</th><th>Dealer</th><th>Price</th><th>Date</th></tr></thead><tbody>';
    data.forEach((item, idx) => {
      html += `<tr data-idx="${idx}" tabindex="0" role="button">
        <td>${escapeHtml(item.Model || '')}</td>
        <td>${escapeHtml(item.Dealer || '')}</td>
        <td>${escapeHtml(item.Price || '')}</td>
        <td>${escapeHtml(item["Date Entered"] || '')}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    // mobile stacked rows
    html += '<div class="mobile-list">';
    data.forEach((item, idx) => {
      html += `<div class="mobile-row" data-idx="${idx}" tabindex="0" role="button">
        <div><strong>${escapeHtml(item.Model || '')}</strong></div>
        <div>${escapeHtml(item.Dealer || '')} • ${escapeHtml(item.Price || '')}</div>
        <div style="font-size:0.9rem;color:#ccc">${escapeHtml(item["Date Entered"] || '')}</div>
      </div>`;
    });
    html += '</div>';
  }

  resultsDiv.innerHTML = html;

  // Event delegation: single handler for clicks on result rows
  const tbody = resultsDiv.querySelector("tbody") || resultsDiv;
  tbody.addEventListener("click", onResultsClick);
  tbody.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const tr = e.target.closest("[data-idx]");
      if (tr) {
        const idx = Number(tr.dataset.idx);
        showResultByIndex(idx);
      }
    }
  });
}

function onResultsClick(e) {
  const tr = e.target.closest("[data-idx]");
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  showResultByIndex(idx);
}

function showResultByIndex(idx) {
  if (!Array.isArray(greyMarketData) || idx < 0 || idx >= greyMarketData.length) return;
  const item = greyMarketData[idx];
  renderDetailCard(item);
  highlightResultRow(idx);
}

// highlight selected row visually
function highlightResultRow(idx) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.querySelectorAll("[data-idx]").forEach((el) => el.classList.remove("is-selected"));
  const sel = resultsDiv.querySelector(`[data-idx="${idx}"]`);
  if (sel) sel.classList.add("is-selected");
}

// ---------- detail dock ----------
function clearDetailDock() {
  const dock = document.getElementById("detailDock");
  dock.innerHTML = "";
}

function renderDetailCard(item) {
  const dock = document.getElementById("detailDock");
  dock.innerHTML = ""; // clear old content

  if (!item) return;

  const card = document.createElement("div");
  card.className = "detail-card card"; // leverage .card styles

  // Image (left on desktop)
  const imgSrc =
    item.ImageFilename && String(item.ImageFilename).startsWith("http")
      ? item.ImageFilename
      : item.ImageFilename
      ? `assets/grey_market/${item.ImageFilename}`
      : "";

  const imgContainer = document.createElement("div");
  imgContainer.style.minWidth = "220px";
  imgContainer.style.maxWidth = "320px";
  imgContainer.style.flex = "0 0 auto";
  imgContainer.style.display = "flex";
  imgContainer.style.alignItems = "center";
  imgContainer.style.justifyContent = "center";

  if (imgSrc) {
    const img = document.createElement("img");
    img.src = imgSrc;
    img.className = "enlargeable-img watch-image";
    img.style.maxWidth = "100%";
    img.style.cursor = "pointer";
    img.onerror = () => (img.style.display = "none");
    imgContainer.appendChild(img);
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      const modal = document.getElementById("imgModal");
      modal.style.display = "flex";
      document.getElementById("imgModalImg").src = imgSrc;
    });
  } else {
    const ph = document.createElement("div");
    ph.style.width = "200px";
    ph.style.height = "160px";
    ph.style.display = "flex";
    ph.style.alignItems = "center";
    ph.style.justifyContent = "center";
    ph.style.background = "#0f0f0f";
    ph.style.border = "1px dashed #444";
    ph.style.borderRadius = "8px";
    ph.textContent = "No image";
    imgContainer.appendChild(ph);
  }

  // Details column
  const details = document.createElement("div");
  details.style.flex = "1 1 auto";
  details.style.minWidth = "240px";

  const title = document.createElement("h3");
  title.textContent = `${item.Model || "—"} • ${item.Price || ""}`;
  title.style.marginTop = "0";
  title.style.marginBottom = "6px";
  title.style.color = "#d4af37";

  const dl = document.createElement("dl");
  dl.style.display = "grid";
  dl.style.gridTemplateColumns = "1fr 1fr";
  dl.style.gap = "8px 20px";

  function addPair(k, v) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    dt.style.fontWeight = "700";
    dt.style.color = "#d4af37";
    dt.style.marginBottom = "2px";
    const dd = document.createElement("dd");
    dd.textContent = v || "—";
    dd.style.margin = "0 0 8px 0";
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  addPair("Unique ID", item["Unique ID"] || item.uniqueId || "");
  addPair("Model Name", item["Model Name"] || "");
  addPair("Nickname/Dial", item["Nickname or Dial"] || "");
  addPair("Dealer", item["Dealer"] || "");
  addPair("Year", item["Year"] || "");
  addPair("Bracelet", item["Bracelet"] || "");
  addPair("Bracelet Metal/Color", item["Bracelet Metal/Color"] || "");
  addPair("Metal", item["Metal"] || "");
  addPair("Full Set", item["Full Set"] || "");
  addPair("Retail Ready", item["Retail Ready"] || "");
  addPair("Current Retail (Not Inc Tax)", item["Current Retail (Not Inc Tax)"] || "");
  addPair("Reference", item["reference"] || item.Reference || "");
  addPair("Date Posted", item["Date Posted"] || "");
  addPair("Comments", item["Comments"] || "");

  // Actions
  const actionRow = document.createElement("div");
  actionRow.style.marginTop = "12px";
  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.style.marginRight = "8px";
  editBtn.addEventListener("click", () => showEditGreyMarketForm(item));
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close details";
  closeBtn.addEventListener("click", clearDetailDock);
  actionRow.appendChild(editBtn);
  actionRow.appendChild(closeBtn);

  details.appendChild(title);
  details.appendChild(dl);
  details.appendChild(actionRow);

  // Append image + details
  card.appendChild(imgContainer);
  card.appendChild(details);

  dock.appendChild(card);

  // Add modal close handler
  const modal = document.getElementById("imgModal");
  modal.onclick = () => (modal.style.display = "none");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.style.display = "none";
  });
}

// simple escape for innerHTML values
function escapeHtml(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// image modal handlers for results-generated imgs
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
