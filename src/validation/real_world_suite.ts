
// Imports removed to rely on HTTP only

// List of 10 DIVERSE real-world variants to test full coverage
const VARIANTS = [
  'TP53:p.R175H',      // Classical PDB
  'BRCA1:p.C61G',      // Mapped Gene
  'BRCA2:p.W31C',      // Mapped Gene
  'EGFR:p.L858R',      // Mapped Gene
  'BRAF:p.V600E',      // Mapped Gene
  'KRAS:p.G12D',       // Mapped Gene
  'PIK3CA:p.H1047R',   // Unmapped -> AlphaFold Fallback Test
  'CFTR:p.F508del',    // Deletion + Mapped
  'IDH1:p.R132H',      // Unmapped -> AlphaFold Fallback Test
  'IDH2:p.R140Q',      // Unmapped -> AlphaFold Fallback Test
];

import * as fs from 'fs';

async function runSuite() {
  console.log(`Starting validation of 10 variants against http://localhost:3000 ...\n`);
  
  const results = {
    total: 0,
    success: 0,
    failed: 0,
    details: [] as any[]
  };

  for (const hgvs of VARIANTS) {
    results.total++;
    let status = 'Failed';
    let note = '';
    let analysisType = 'N/A';
    let analysisSnippet = '';

    try {
      console.log(`[${results.total}/${VARIANTS.length}] Testing ${hgvs}...`);
      
      const response = await fetch('http://localhost:3000/api/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hgvs: hgvs }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`${response.status} - ${err.error || JSON.stringify(err)}`);
      }

      const data = await response.json();
      
      if (!data.structure) {
        throw new Error('No structure returned');
      }

      analysisType = data.hypothesis?.text?.includes('unavailable') ? '⚠️ Fallback' : '✅ Generated';
      analysisSnippet = data.hypothesis?.text?.slice(0, 100) + '...';
      
      console.log(`  ✅ Structure: ${data.structure.source} | Analysis: ${analysisType}`);
      status = 'Passed';
      note = `Structure: ${data.structure.source}, Analysis: ${analysisType}`;
      results.success++;

    } catch (error) {
      console.error(`  ❌ FAILED: ${hgvs} - ${(error as Error).message}`);
      status = 'Failed';
      note = (error as Error).message;
      results.failed++;
    }

    results.details.push({ hgvs, status, note, analysisType, analysisSnippet });
    
    // 10 second delay to respect Rate Limits (6 req/min)
    console.log('  Waiting 10s...');
    await new Promise(r => setTimeout(r, 10000));
  }

  // Generate Report
  const reportContent = `# VariantLens Validation Report
Date: ${new Date().toISOString()}
Total: ${results.total}
Success: ${results.success}
Failed: ${results.failed}

## Detailed Results

| Variant | Status | Analysis State | Notes |
|---------|--------|----------------|-------|
${results.details.map(d => `| \`${d.hgvs}\` | ${d.status === 'Passed' ? '✅ Passed' : '❌ Failed'} | ${d.analysisType} | ${d.note} |`).join('\n')}

## Analysis Snippets (First 5)
${results.details.slice(0, 5).map(d => `### ${d.hgvs}\n> ${d.analysisSnippet || 'No analysis'}`).join('\n\n')}
`;

  fs.writeFileSync('validation_report.md', reportContent);
  console.log('\nReport generated: validation_report.md');
}

runSuite().catch(console.error);
