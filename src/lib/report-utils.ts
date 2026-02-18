import { HonestReportData } from './types/honest-response';

interface ProvenanceEntry {
  source: string;
  id?: string;
  url?: string;
  method: 'exact_match' | 'experimental_structure' | 'database_lookup' | 'residue_mapping' | 'ai_synthesis' | 'query_match';
  confidence?: string;
  notes?: string;
}

// Helper to generate Markdown content
export function generateMarkdown(data: HonestReportData): string {
  const { variant, coverage, unknowns } = data;
  const date = new Date().toISOString().split('T')[0]; // ISO 8601
  const timestamp = data.timestamp || new Date().toISOString();
  const canonicalTarget = variant.normalizedHgvs || variant.hgvs;
  const submittedTarget = variant.originalHgvs && variant.originalHgvs !== canonicalTarget
    ? variant.originalHgvs
    : null;
  
  // Format clinical status
  const clinicalStatus = coverage.clinical.status !== 'none' 
    ? `**ClinVar Status:** ${coverage.clinical.status.toUpperCase()}` 
    : 'No ClinVar records found.';

  const clinvarId = coverage.clinical.clinvarId 
    ? `**ClinVar ID:** [${coverage.clinical.clinvarId}](${coverage.clinical.url})` 
    : '';

  // Format structure status
  const afUrl = `https://alphafold.ebi.ac.uk/entry/${coverage.structure.id}`;
  const structureInfo = coverage.structure.status === 'experimental'
    ? `**Structure:** ${coverage.structure.source} ID [${coverage.structure.id}](https://www.rcsb.org/structure/${coverage.structure.id})`
    : coverage.structure.status === 'predicted'
    ? `**Structure:** [AlphaFold Prediction](${afUrl}) [${coverage.structure.id}]`
    : 'No structural data available.';
    
  // Build Provenance Chain
  const provenance: ProvenanceEntry[] = [];
  
  // 1. Structure Provenance
  if (coverage.structure.id) {
    const isPdb = coverage.structure.source === 'PDB';
    provenance.push({
      source: coverage.structure.source || 'Structure DB',
      id: coverage.structure.id,
      url: isPdb ? `https://www.rcsb.org/structure/${coverage.structure.id}` : afUrl,
      method: isPdb ? 'experimental_structure' : 'database_lookup',
      notes: coverage.structure.sifts?.mapped ? 'Residue mapped via SIFTS' : undefined
    });
  }

  // 2. Clinical Provenance
  if (coverage.clinical.clinvarId) {
    provenance.push({
      source: 'ClinVar',
      id: coverage.clinical.clinvarId,
      url: coverage.clinical.url,
      method: 'exact_match',
      confidence: `${coverage.clinical.stars} stars (${coverage.clinical.reviewStatus})`
    });
  }

  // 3. Literature Provenance
  const pubmedQuery = coverage.literature.query || 'variant-lens-search';
  provenance.push({
    source: 'PubMed',
    method: 'query_match',
    notes: `Broad Context Query: ${pubmedQuery.replace(/"/g, '')}`
  });

  const provenanceRows = provenance.map(p => {
    const methodDisplay = p.method.replace(/_/g, ' '); // Global replace
    const confDisplay = p.confidence ? ` (Conf: ${p.confidence})` : '';
    return `*   **${p.source}:** ${p.id ? `\`${p.id}\`` : ''} [${methodDisplay}]${confDisplay} ${p.notes ? `- ${p.notes}` : ''}`;
  }).join('\n');

  const evidenceStamp = `
---
### 🛡 Evidence Stamp & Provenance
*   **Generated:** ${timestamp}
*   **Target:** ${canonicalTarget}
${submittedTarget ? `*   **Submitted:** ${submittedTarget}` : ''}
${provenanceRows}

*Disclaimer: This report aggregates evidence and makes no clinical claims. Counts are discovery-only and reflect query matches. RESEARCH USE ONLY.*
---
`;

  return `
# Variant Lens Evidence Briefing
**Variant:** ${canonicalTarget} (${variant.gene} residue ${variant.residue})
${submittedTarget ? `**Submitted:** ${submittedTarget}` : ''}
**Date:** ${date}

## 1. Clinical & Structural Coverage
*   ${clinicalStatus}
${clinvarId ? `*   ${clinvarId}` : ''}
*   ${structureInfo}
*   **Domain Context:** ${(coverage.domain.inAnnotatedDomain && coverage.domain.domainName) 
      ? `Residue maps to the annotated ${coverage.domain.domainName} domain (UniProt feature mapping).` 
      : 'Residue does not fall within a known functional domain (UniProt mapping).'}

## 2. Literature Signal
*   **Direct Matches:** ${coverage.literature.variantSpecificCount} papers found for full variant string.
*   **Broad Context:** Search query \`${pubmedQuery.replace(/"/g, '')}\` used for gene/protein context.

## 3. Unknowns & Gaps
${unknowns.items.length > 0 ? unknowns.items.map((u: string) => `*   ${u}`).join('\n') : '*   No major gaps identified in available databases.'}

${evidenceStamp}

*VariantLens v${process.env.APP_VERSION || '2.0.0'} (${(process.env.COMMIT_SHA || 'dev').substring(0, 7)})*
`;
}
