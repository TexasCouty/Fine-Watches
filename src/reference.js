/* Reference lookup UI – adds compact fact line above details */
const refEls = {
input: document.getElementById('referenceInput'),
btn: document.getElementById('referenceBtn'),
out: document.getElementById('referenceOut')
};


refEls.btn?.addEventListener('click', runRef);
refEls.input?.addEventListener('keydown', (e)=> { if(e.key==='Enter') runRef(); });


async function runRef(){
const ref = (refEls.input?.value || '').trim();
if (!ref) return;
refEls.out.innerHTML = '<div class="skel" style="height:120px"></div>';
try {
const r = await fetch(`/.netlify/functions/referenceLookup?ref=${encodeURIComponent(ref)}`);
const data = await r.json();
renderRef(data);
} catch (err) {
console.error('referenceLookup error', err); refEls.out.textContent = 'Error fetching reference.';
}
}


function renderRef(d){
if (!d) { refEls.out.textContent = 'No data'; return; }
const parts = [];
const factLine = [d.Reference, d.Brand, d.Collection, d.PriceAmount? `$${Number(d.PriceAmount).toLocaleString()}` : null]
.filter(Boolean).join(' • ');
if (factLine) parts.push(`<div class="badge">${escapeHtml(factLine)}</div>`);


if (d.Description) parts.push(`<p>${escapeHtml(d.Description)}</p>`);
if (d.Caliber) parts.push(`<p><b>Caliber:</b> ${escapeHtml(d.Caliber)}</p>`);


refEls.out.innerHTML = parts.join('\n');
}


function escapeHtml(s){ return String(s||'').replace(/[&<>]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m])); }