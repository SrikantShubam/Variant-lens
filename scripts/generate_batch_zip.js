
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const ARTIFACT_DIR = String.raw`C:\Users\srika\.gemini\antigravity\brain\ef01f6bb-b5c8-4619-a823-01e19123f10b`;
const CSV_PATH = path.join(ARTIFACT_DIR, 'batch_test.csv');
const ZIP_PATH = path.join(ARTIFACT_DIR, 'batch_results.zip');
const API_URL = 'http://localhost:3000/api/variant?format=md';

async function main() {
  console.log(`Reading CSV from ${CSV_PATH}...`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV file not found!");
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  // Remove header
  const variants = lines.slice(1).map(l => l.split(',')[0].trim());

  console.log(`Found ${variants.length} variants:`, variants);

  const zip = new JSZip();
  const folder = zip.folder("variant-lens-reports");

  for (const hgvs of variants) {
    console.log(`Processing ${hgvs}...`);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs }),
      });

      if (!res.ok) {
        console.error(`Failed to fetch ${hgvs}: ${res.status} ${res.statusText}`);
        folder.file(`${hgvs}_error.txt`, `API Error: ${res.status}`);
        continue;
      }

      const md = await res.text();
      const filename = hgvs.replace(/[^a-zA-Z0-9_\-\.]/g, '_') + '.md';
      folder.file(filename, md);
      console.log(`Saved ${filename}`);

    } catch (e) {
      console.error(`Error processing ${hgvs}:`, e);
      folder.file(`${hgvs}_error.txt`, `Error: ${String(e)}`);
    }
  }

  console.log("Generating Zip...");
  const content = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(ZIP_PATH, content);
  console.log(`Zip saved to ${ZIP_PATH}`);
}

main();
