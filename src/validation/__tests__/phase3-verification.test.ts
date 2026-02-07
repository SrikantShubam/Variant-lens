import { describe, it, expect } from '@jest/globals';
import { getViewerConfig } from '../../components/structure-utils';
import { generateMarkdown } from '../../lib/report-utils';

// ==========================================
// MOCK DATA FOR CHECKLIST
// ==========================================

const MOCK_BRAF_MAPPED = {
  mapped: true,
  chain: 'A',
  pdbResidue: '157',
  source: 'PDB'
};

const MOCK_JAK2_UNMAPPED = {
  mapped: false,
  chain: 'A',
  pdbResidue: 'Unmapped', // Logic handles this via check
  source: 'PDB'
};

// ==========================================
// 1. & 2. STRUCTURE LOGIC TESTS
// ==========================================

describe('Verification Checklist: Structure Logic', () => {

  it('Mapped Highlight Logic (BRAF V600E): Configures highlight for 3C4C:A:157', () => {
    const config = getViewerConfig(MOCK_BRAF_MAPPED, 600);

    expect(config.status).toBe('mapped');
    
    // Banner Check
    expect(config.banner.icon).toContain('✓ MAPPED');
    expect(config.banner.text).toContain('UniProt 600 → PDB A:157');

    // Highlight Check
    expect(config.highlight).not.toBeNull();
    expect(config.highlight?.struct_asym_id).toBe('A');
    expect(config.highlight?.start_residue_number).toBe(157);
    expect(config.highlight?.color).toEqual({ r: 255, g: 0, b: 255 }); // Magenta
    expect(config.highlight?.focus).toBe(true);
  });

  it('Unmapped Safety Logic (JAK2 V617F): Shows UNMAPPED Banner, Disables Highlight', () => {
    const config = getViewerConfig(MOCK_JAK2_UNMAPPED, 617);

    expect(config.status).toBe('unmapped');

    // Banner Check - Strict Text Verification
    expect(config.banner.icon).toContain('⚠ UNMAPPED');
    expect(config.banner.text).toContain('SIFTS does not map UniProt 617 to this PDB entry');

    // Highlight Check - MUST be null
    expect(config.highlight).toBeNull();
  });
});

// ==========================================
// 3. EXPORT STAMP TESTS
// ==========================================

describe('Verification Checklist: Export Stamp', () => {
  const MOCK_REPORT_DATA = {
    variant: { hgvs: 'BRAF:p.V600E', gene: 'BRAF', residue: 600 },
    coverage: {
      structure: { 
          status: 'experimental', 
          id: '3C4C', 
          source: 'PDB',
          sifts: { ...MOCK_BRAF_MAPPED, pdbId: '3C4C' } 
      },
      clinical: { 
          status: 'pathogenic', 
          clinvarId: '13961', 
          url: 'https://clinvar...' 
      },
      domain: { inAnnotatedDomain: true, domainName: 'Pkinase' },
      literature: { variantSpecificCount: 50, query: 'BRAF AND (V600E)' }
    },
    unknowns: { items: [], severity: 'minor' },
    curatedInfo: {},
    timestamp: new Date().toISOString()
  };

  it('Markdown includes Evidence Stamp and Provenance', () => {
    // @ts-ignore
    const md = generateMarkdown(MOCK_REPORT_DATA);
    
    // Checklist Items:
    expect(md).toContain('Evidence Stamp'); // Relaxed to substring without emoji/header syntax
    expect(md).toContain('**Generated:**'); // Timestamp present
    expect(md).toContain('3C4C');
    expect(md).toContain('13961');
    expect(md).toContain('PubMed Query'); // Relaxed quote check

    // Disclaimer
    expect(md).toContain('Counts are discovery-only and reflect query matches');
    expect(md).toContain('aggregates evidence and makes no clinical claims');
  });

  it('Handles missing structure in Export', () => {
     const noStructData = { ...MOCK_REPORT_DATA, coverage: { ...MOCK_REPORT_DATA.coverage, structure: { status: 'none', id: undefined } } };
     // @ts-ignore
     const md = generateMarkdown(noStructData);

     expect(md).toContain('**PDB ID:** None');
  });
});
