import { HonestReportData } from './types/honest-response';

// Helper to generate Markdown content
export function generateMarkdown(data: HonestReportData): string {
  const { variant, coverage, unknowns } = data;
  const date = new Date().toLocaleDateString();
  const timestamp = data.timestamp || new Date().toISOString();
  
  // Format clinical status
  const clinicalStatus = coverage.clinical.status !== 'none' 
    ? `**ClinVar Status:** ${coverage.clinical.status.toUpperCase()}` 
    : 'No ClinVar records found.';

  const clinvarId = coverage.clinical.clinvarId 
    ? `**ClinVar ID:** [${coverage.clinical.clinvarId}](${coverage.clinical.url})` 
    : '';

  // Format structure status
  const structureInfo = coverage.structure.status === 'experimental'
    ? `**Structure:** ${coverage.structure.source} ID [${coverage.structure.id}](https://www.rcsb.org/structure/${coverage.structure.id})`
    : coverage.structure.status === 'predicted'
    ? `**Structure:** AlphaFold Prediction [${coverage.structure.id}]`
    : 'No structural data available.';
    
  // Format Evidence Stamp (Provenance)
  const structuralEvidence = coverage.structure.id 
    ? `**PDB ID:** ${coverage.structure.id || 'None'} ${coverage.structure.sifts?.mapped ? '(Mapped)' : '(Unmapped)'}`
    : '**PDB ID:** None';
    
  const evidenceStamp = `
---
### 🛡 Evidence Stamp & Provenance
*   **Generated:** ${timestamp}
*   **Query:** ${variant.hgvs}
*   **PubMed Query:** "${coverage.literature.query}"
*   ${structuralEvidence}
*   ${clinvarId ? `**ClinVar ID:** ${coverage.clinical.clinvarId}` : '**ClinVar ID:** None'}

*Disclaimer: This report aggregates evidence and makes no clinical claims. Counts are discovery-only and reflect query matches. RESEARCH USE ONLY.*
---
`;

  return `
# Variant Lens Evidence Briefing
**Variant:** ${variant.hgvs} (${variant.gene} residue ${variant.residue})
**Date:** ${date}

## 1. Clinical & Structural Coverage
*   ${clinicalStatus} ${clinvarId ? `(${clinvarId})` : ''}
*   ${structureInfo}
*   **Domain Context:** ${coverage.domain.inAnnotatedDomain ? `Located in ${coverage.domain.domainName}` : 'No known functional domain.'}

## 2. Literature Signal
*   **Direct Matches:** ${coverage.literature.variantSpecificCount} papers found for full variant string.
*   **Gene Context:** Search query \`${coverage.literature.query}\` used for broad context.

## 3. Unknowns & Gaps
${unknowns.items.length > 0 ? unknowns.items.map((u: string) => `*   ${u}`).join('\n') : '*   No major gaps identified in available databases.'}

${evidenceStamp}
`;
}
