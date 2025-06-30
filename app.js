async function lookupReference() {
  const ref = document.getElementById('refInput').value.trim();
  const response = await fetch('patek_refs.json');
  const data = await response.json();

  const match = data.find(item => item.reference.toLowerCase() === ref.toLowerCase());
  const resultDiv = document.getElementById('result');

  if (match) {
    resultDiv.innerHTML = `
      <h2>Reference: ${match.reference}</h2>
      <p><strong>Retail Price:</strong> ${match.retail_price}</p>
      <p><strong>Dial:</strong> ${match.dial}</p>
      <p><strong>Case:</strong> ${match.case}</p>
      <p><strong>Bracelet:</strong> ${match.bracelet}</p>
      <p><strong>Movement:</strong> ${match.movement}</p>
    `;
  } else {
    resultDiv.innerHTML = `<p>Reference not found.</p>`;
  }
}
