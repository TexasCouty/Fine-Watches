/* Main UI controller – mobile-first cards + desktop table fallback
function closeEditSheet(){ els.sheet.classList.remove('open'); els.sheetOpenForId = null; }


// Save handler (also handles signed Cloudinary upload if a new file is chosen)
els.sheetForm?.addEventListener('submit', async (e)=>{
e.preventDefault();
const fd = new FormData(els.sheetForm);


// If a new image file selected, upload to Cloudinary (signed)
const file = fd.get('imageFile');
if (file && file.size>0) {
const uploadedUrl = await uploadToCloudinarySigned(file);
if (uploadedUrl) fd.set('ImageUrl', uploadedUrl);
}
fd.delete('imageFile'); // never send binary to our function


const payload = Object.fromEntries(fd.entries());
payload._id = els.sheetOpenForId;


// Coerce some fields
if ('Price' in payload) payload.Price = +payload.Price || payload.Price;
if ('FullSet' in payload) payload.FullSet = els.sheetForm.querySelector('[name="FullSet"]').checked;
if ('RetailReady' in payload) payload.RetailReady = els.sheetForm.querySelector('[name="RetailReady"]').checked;


const r = await fetch('/.netlify/functions/updateGreyMarket', {
method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)
});
if (!r.ok){ alert('Save failed'); return; }
closeEditSheet();
// refresh results
searchGreyMarket(els.search.value || '');
});


/*────────────────────────────────────────────────────────────────────────────*/
// Signed Cloudinary upload helper
async function uploadToCloudinarySigned(file){
try {
// 1) ask our Netlify function for signature
const sigRes = await fetch('/.netlify/functions/getCloudinarySignature');
const { timestamp, signature, api_key, cloud_name, folder } = await sigRes.json();


// 2) upload to Cloudinary
const form = new FormData();
form.append('file', file);
form.append('api_key', api_key);
form.append('timestamp', timestamp);
form.append('signature', signature);
if (folder) form.append('folder', folder);


const cloudUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/auto/upload`;
const up = await fetch(cloudUrl, { method: 'POST', body: form });
const data = await up.json();
if (!up.ok) throw new Error(data.error?.message || 'Cloudinary upload failed');
return data.secure_url;
} catch (err){
console.error(err); alert('Image upload failed.'); return null;
}
}


/*────────────────────────────────────────────────────────────────────────────*/
// Filters bar interactions
function bindFilters(){
if (!els.chips) return;
els.chips.addEventListener('click', (e)=>{
const btn = e.target.closest('[data-chip]'); if (!btn) return;
const key = btn.getAttribute('data-chip');
if (key==='fullSet' || key==='retailReady') state.filters[key] = !state.filters[key];
// If chips have data-value (like specific year/metal), set that
if (btn.dataset.value) state.filters[key] = btn.dataset.value;
btn.classList.toggle('active');
searchGreyMarket(els.search.value || '');
});
}


/*────────────────────────────────────────────────────────────────────────────*/
// Events
els.search?.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ searchGreyMarket(e.currentTarget.value); }});
window.addEventListener('resize', ()=> render());
document.getElementById('modalClose')?.addEventListener('click', closeImgModal);
document.getElementById('sheetClose')?.addEventListener('click', closeEditSheet);


// Initial load
bindFilters();
searchGreyMarket('');