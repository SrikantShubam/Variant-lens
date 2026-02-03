
async function runSingle() {
  const hgvs = 'BRCA1:p.C61G';
  console.log(`Testing ${hgvs}...`);
  const response = await fetch('http://localhost:3000/api/variant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hgvs: hgvs }),
  });

  const text = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Body: ${text.slice(0, 500)}`);
}

runSingle().catch(console.error);
