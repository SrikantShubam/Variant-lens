/**
 * FROZEN TEST DATASET - DO NOT MODIFY
 * 
 * 20 real variants with ground truth for testing:
 * - Domain correctness
 * - Unknown detection
 * - Negative controls
 * - Variant position validity
 * 
 * Sources: UniProt, ClinVar, COSMIC
 * Frozen: 2026-02-04
 */

export interface TestVariant {
  hgvs: string;
  gene: string;
  uniprotId: string;
  residueNumber: number;
  proteinLength: number; // For validity check
  
  // Ground truth
  expectedDomain: string | null;
  domainRange: [number, number] | null;
  clinicalSignificance: 'pathogenic' | 'benign' | 'vus' | 'none';
  hasPdbStructure: boolean;
  hasAlphaFold: boolean;
  variantSpecificPapers: number; // Known count
  
  // Test category
  category: 'positive' | 'negative_no_data' | 'negative_outside_domain' | 'invalid_position';
}

export const TEST_DATASET: TestVariant[] = [
  // ==========================================
  // POSITIVE CASES - Well-characterized variants
  // ==========================================
  {
    hgvs: 'JAK2:p.V617F',
    gene: 'JAK2',
    uniprotId: 'O60674',
    residueNumber: 617,
    proteinLength: 1132,
    expectedDomain: 'Protein kinase-like (JH2)',
    domainRange: [536, 812],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 500, // Many papers
    category: 'positive',
  },
  {
    hgvs: 'BRAF:p.V600E',
    gene: 'BRAF',
    uniprotId: 'P15056',
    residueNumber: 600,
    proteinLength: 766,
    expectedDomain: 'Protein kinase',
    domainRange: [457, 717],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 300,
    category: 'positive',
  },
  {
    hgvs: 'TP53:p.R175H',
    gene: 'TP53',
    uniprotId: 'P04637',
    residueNumber: 175,
    proteinLength: 393,
    expectedDomain: 'DNA-binding',
    domainRange: [94, 292],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 200,
    category: 'positive',
  },
  {
    hgvs: 'BRCA1:p.C61G',
    gene: 'BRCA1',
    uniprotId: 'P38398',
    residueNumber: 61,
    proteinLength: 1863,
    expectedDomain: 'RING-type',
    domainRange: [1, 109],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 50,
    category: 'positive',
  },
  {
    hgvs: 'EGFR:p.L858R',
    gene: 'EGFR',
    uniprotId: 'P00533',
    residueNumber: 858,
    proteinLength: 1210,
    expectedDomain: 'Protein kinase',
    domainRange: [712, 979],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 100,
    category: 'positive',
  },
  {
    hgvs: 'KRAS:p.G12D',
    gene: 'KRAS',
    uniprotId: 'P01116',
    residueNumber: 12,
    proteinLength: 189,
    expectedDomain: 'Ras',
    domainRange: [1, 166],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 150,
    category: 'positive',
  },
  {
    hgvs: 'PIK3CA:p.H1047R',
    gene: 'PIK3CA',
    uniprotId: 'P42336',
    residueNumber: 1047,
    proteinLength: 1068,
    expectedDomain: 'PI3K/PI4K kinase',
    domainRange: [797, 1068],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 80,
    category: 'positive',
  },
  {
    hgvs: 'IDH1:p.R132H',
    gene: 'IDH1',
    uniprotId: 'O75874',
    residueNumber: 132,
    proteinLength: 414,
    expectedDomain: 'Isocitrate dehydrogenase',
    domainRange: [1, 414],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 60,
    category: 'positive',
  },
  {
    hgvs: 'CFTR:p.F508del',
    gene: 'CFTR',
    uniprotId: 'P13569',
    residueNumber: 508,
    proteinLength: 1480,
    expectedDomain: 'ABC transporter NBD1',
    domainRange: [389, 678],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 200,
    category: 'positive',
  },
  {
    hgvs: 'PTEN:p.R130G',
    gene: 'PTEN',
    uniprotId: 'P60484',
    residueNumber: 130,
    proteinLength: 403,
    expectedDomain: 'Phosphatase tensin-type',
    domainRange: [7, 185],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 30,
    category: 'positive',
  },

  // ==========================================
  // NEGATIVE CASES - Variant outside known domain
  // ==========================================
  {
    hgvs: 'BRCA1:p.S1040N',
    gene: 'BRCA1',
    uniprotId: 'P38398',
    residueNumber: 1040,
    proteinLength: 1863,
    expectedDomain: null, // Outside annotated domains
    domainRange: null,
    clinicalSignificance: 'vus',
    hasPdbStructure: false,
    hasAlphaFold: true,
    variantSpecificPapers: 2,
    category: 'negative_outside_domain',
  },
  {
    hgvs: 'TP53:p.P20S',
    gene: 'TP53',
    uniprotId: 'P04637',
    residueNumber: 20,
    proteinLength: 393,
    expectedDomain: null, // N-terminal, before DNA-binding
    domainRange: null,
    clinicalSignificance: 'vus',
    hasPdbStructure: false,
    hasAlphaFold: true,
    variantSpecificPapers: 1,
    category: 'negative_outside_domain',
  },

  // ==========================================
  // NEGATIVE CASES - No data available
  // ==========================================
  {
    hgvs: 'OBSCN:p.R4831H',
    gene: 'OBSCN',
    uniprotId: 'Q5VST9',
    residueNumber: 4831,
    proteinLength: 8563,
    expectedDomain: null, // Giant protein, sparse annotation
    domainRange: null,
    clinicalSignificance: 'none',
    hasPdbStructure: false,
    hasAlphaFold: false, // Too large
    variantSpecificPapers: 0,
    category: 'negative_no_data',
  },
  {
    hgvs: 'TTN:p.A100V',
    gene: 'TTN',
    uniprotId: 'Q8WZ42',
    residueNumber: 100,
    proteinLength: 34350,
    expectedDomain: null, // Huge protein
    domainRange: null,
    clinicalSignificance: 'none',
    hasPdbStructure: false,
    hasAlphaFold: false,
    variantSpecificPapers: 0,
    category: 'negative_no_data',
  },
  {
    hgvs: 'MUC16:p.S1000L',
    gene: 'MUC16',
    uniprotId: 'Q8WXI7',
    residueNumber: 1000,
    proteinLength: 14507,
    expectedDomain: null,
    domainRange: null,
    clinicalSignificance: 'none',
    hasPdbStructure: false,
    hasAlphaFold: false,
    variantSpecificPapers: 0,
    category: 'negative_no_data',
  },

  // ==========================================
  // BENIGN CONTROLS
  // ==========================================
  {
    hgvs: 'BRCA2:p.N372H',
    gene: 'BRCA2',
    uniprotId: 'P51587',
    residueNumber: 372,
    proteinLength: 3418,
    expectedDomain: null,
    domainRange: null,
    clinicalSignificance: 'benign',
    hasPdbStructure: false,
    hasAlphaFold: true,
    variantSpecificPapers: 10,
    category: 'positive', // Known benign
  },

  // ==========================================
  // INVALID POSITION CASES (for validity testing)
  // ==========================================
  {
    hgvs: 'TP53:p.R500H', // Position > protein length (393)
    gene: 'TP53',
    uniprotId: 'P04637',
    residueNumber: 500,
    proteinLength: 393,
    expectedDomain: null,
    domainRange: null,
    clinicalSignificance: 'none',
    hasPdbStructure: false,
    hasAlphaFold: false,
    variantSpecificPapers: 0,
    category: 'invalid_position',
  },
  {
    hgvs: 'BRCA1:p.L2000P', // Position > protein length (1863)
    gene: 'BRCA1',
    uniprotId: 'P38398',
    residueNumber: 2000,
    proteinLength: 1863,
    expectedDomain: null,
    domainRange: null,
    clinicalSignificance: 'none',
    hasPdbStructure: false,
    hasAlphaFold: false,
    variantSpecificPapers: 0,
    category: 'invalid_position',
  },

  // ==========================================
  // EDGE CASES
  // ==========================================
  {
    hgvs: 'AKT1:p.E17K',
    gene: 'AKT1',
    uniprotId: 'P31749',
    residueNumber: 17,
    proteinLength: 480,
    expectedDomain: 'PH domain',
    domainRange: [6, 108],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 40,
    category: 'positive',
  },
  {
    hgvs: 'ERBB2:p.L755S',
    gene: 'ERBB2',
    uniprotId: 'P04626',
    residueNumber: 755,
    proteinLength: 1255,
    expectedDomain: 'Protein kinase',
    domainRange: [720, 987],
    clinicalSignificance: 'pathogenic',
    hasPdbStructure: true,
    hasAlphaFold: true,
    variantSpecificPapers: 20,
    category: 'positive',
  },
];

// ==========================================
// TEST CATEGORY HELPERS
// ==========================================

export const getPositiveCases = () => 
  TEST_DATASET.filter(v => v.category === 'positive');

export const getNegativeNoDatCases = () => 
  TEST_DATASET.filter(v => v.category === 'negative_no_data');

export const getNegativeOutsideDomainCases = () => 
  TEST_DATASET.filter(v => v.category === 'negative_outside_domain');

export const getInvalidPositionCases = () => 
  TEST_DATASET.filter(v => v.category === 'invalid_position');

// Freeze to prevent accidental modification
Object.freeze(TEST_DATASET);
TEST_DATASET.forEach(v => Object.freeze(v));
