export type GoldenCaseTier = 'famous' | 'obscure' | 'vus_benign' | 'edge';

export interface GoldenCase {
  id: number;
  hgvs: string;
  tier: GoldenCaseTier;
  note: string;
  expected: {
    expectedStatus?: number;
    normalized?: string;
    transcript?: string;
    expectedGene?: string;
    expectedUniprotId?: string;
    mustNotGene?: string;
    variantType?: 'missense' | 'stop-gain' | 'deletion' | 'insertion' | 'duplication' | 'frameshift' | 'silent' | 'unknown';
    residue?: number;
    isValidPosition?: boolean;
    domainShouldBeAnnotated?: boolean;
    domainNameIncludes?: string;
    clinicalShouldBePathogenicOrLikely?: boolean;
    unknownSeverityDefined?: boolean;
    errorContains?: string;
    repeatCallShouldMatch?: boolean;
    repeatCallMaxMs?: number;
    apiShouldReject?: boolean;
    apiErrorCode?: 'UNKNOWN_GENE' | 'INVALID_POSITION';
  };
}

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: 1,
    hgvs: 'TP53:p.R175H',
    tier: 'famous',
    note: 'Well-characterized pathogenic variant with strong structural and clinical support.',
    expected: {
      normalized: 'TP53:p.R175H',
      domainShouldBeAnnotated: true,
      domainNameIncludes: 'dna',
    },
  },
  {
    id: 2,
    hgvs: 'BRAF:p.V600E',
    tier: 'famous',
    note: 'High-signal oncology benchmark with abundant evidence.',
    expected: { normalized: 'BRAF:p.V600E' },
  },
  {
    id: 3,
    hgvs: 'CFTR:p.F508del',
    tier: 'famous',
    note: 'Classic deletion benchmark with established disease mechanism.',
    expected: { normalized: 'CFTR:p.F508del' },
  },
  {
    id: 4,
    hgvs: 'NDUFAF6:p.A178P',
    tier: 'obscure',
    note: 'AlphaFold-forward, lower-evidence scenario with potentially conflicting ClinVar context.',
    expected: {
      normalized: 'NDUFAF6:p.A178P',
      domainShouldBeAnnotated: true,
      domainNameIncludes: 'sqs',
    },
  },
  {
    id: 5,
    hgvs: 'SURF1:p.V177M',
    tier: 'obscure',
    note: 'Rare Leigh syndrome gene; useful for sparse-data handling.',
    expected: {
      normalized: 'SURF1:p.V177M',
      expectedGene: 'SURF1',
      expectedUniprotId: 'Q15526',
      mustNotGene: 'PROM1',
    },
  },
  {
    id: 6,
    hgvs: 'POLG:p.A889T',
    tier: 'obscure',
    note: 'Mitochondrial disease gene with mixed evidence quality across sources.',
    expected: { normalized: 'POLG:p.A889T' },
  },
  {
    id: 7,
    hgvs: 'BRCA1:p.Q356R',
    tier: 'vus_benign',
    note: 'Commonly treated as benign/likely benign in many contexts.',
    expected: { normalized: 'BRCA1:p.Q356R' },
  },
  {
    id: 8,
    hgvs: 'TTN:p.R12345G',
    tier: 'vus_benign',
    note: 'Large-gene missense stress case where over-calling risk is high.',
    expected: { normalized: 'TTN:p.R12345G' },
  },
  {
    id: 9,
    hgvs: 'NM_152416.4(NDUFAF6):p.Ala178Pro',
    tier: 'edge',
    note: 'Full transcript-prefixed protein HGVS format.',
    expected: { normalized: 'NDUFAF6:p.A178P', transcript: 'NM_152416.4' },
  },
  {
    id: 10,
    hgvs: 'NDUFAF6:p.A178P',
    tier: 'edge',
    note: 'One-letter amino-acid representation.',
    expected: { normalized: 'NDUFAF6:p.A178P' },
  },
  {
    id: 11,
    hgvs: 'tp53 : p. r175h',
    tier: 'edge',
    note: 'Whitespace and lowercase robustness check.',
    expected: { normalized: 'TP53:p.R175H' },
  },
  {
    id: 12,
    hgvs: 'FAKEGENE:p.G123A',
    tier: 'edge',
    note: 'Non-existent gene should fail gracefully at resolution stage.',
    expected: { normalized: 'FAKEGENE:p.G123A', apiShouldReject: true, apiErrorCode: 'UNKNOWN_GENE' },
  },
  {
    id: 13,
    hgvs: 'CFTR:p.I507I',
    tier: 'edge',
    note: 'Synonymous change to verify non-missense handling.',
    expected: { normalized: 'CFTR:p.I507I' },
  },
  {
    id: 14,
    hgvs: 'KRAS:p.G12D',
    tier: 'edge',
    note: 'Multiple-PDB benchmark to validate structure ranking and mapping.',
    expected: {
      normalized: 'KRAS:p.G12D',
      domainShouldBeAnnotated: true,
      domainNameIncludes: 'switch',
    },
  },
  {
    id: 15,
    hgvs: 'PTPN11:p.N308D',
    tier: 'famous',
    note: 'Noonan syndrome hotspot with good structural support.',
    expected: { normalized: 'PTPN11:p.N308D' },
  },
  {
    id: 16,
    hgvs: 'RYR1:p.R163C',
    tier: 'obscure',
    note: 'Malignant hyperthermia variant in a large protein.',
    expected: { normalized: 'RYR1:p.R163C' },
  },
  {
    id: 17,
    hgvs: 'MT-TL1:m.3243A>G',
    tier: 'edge',
    note: 'Mitochondrial nucleotide HGVS (non-protein notation) should be rejected.',
    expected: { apiShouldReject: true },
  },
  {
    id: 18,
    hgvs: 'BRCA2:p.Ser1982Argfs*22',
    tier: 'edge',
    note: 'Frameshift notation should normalize and parse robustly.',
    expected: { normalized: 'BRCA2:p.S1982fs' },
  },
  {
    id: 19,
    hgvs: 'CFTR:c.1521_1523delCTT',
    tier: 'edge',
    note: 'Legacy c. notation should be rejected with a protein-HGVS message.',
    expected: { apiShouldReject: true },
  },
  {
    id: 20,
    hgvs: 'PROM1:p.R373C',
    tier: 'edge',
    note: 'PROM1 control should not collide with SURF1 mapping.',
    expected: {
      normalized: 'PROM1:p.R373C',
      expectedGene: 'PROM1',
      expectedUniprotId: 'O43490',
      mustNotGene: 'SURF1',
    },
  },
  {
    id: 21,
    hgvs: 'ABCC7:p.F508del',
    tier: 'edge',
    note: 'Alias should normalize to CFTR.',
    expected: {
      normalized: 'CFTR:p.F508del',
      expectedGene: 'CFTR',
      expectedUniprotId: 'P13569',
    },
  },
  {
    id: 22,
    hgvs: 'G6PD:p.V68M',
    tier: 'famous',
    note: 'Domain and functional-site rich enzyme test.',
    expected: { normalized: 'G6PD:p.V68M', domainShouldBeAnnotated: true },
  },
  {
    id: 23,
    hgvs: 'HBB:p.E26K',
    tier: 'famous',
    note: 'Hemoglobin C variant inside globin domain.',
    expected: { normalized: 'HBB:p.E26K', domainShouldBeAnnotated: true },
  },
  {
    id: 24,
    hgvs: 'SCN5A:p.R1623Q',
    tier: 'obscure',
    note: 'Voltage-gated channel domain stress case.',
    expected: { normalized: 'SCN5A:p.R1623Q', domainShouldBeAnnotated: true },
  },
  {
    id: 25,
    hgvs: 'CFTR:p.G542*',
    tier: 'edge',
    note: 'Nonsense/stop-gain notation handling.',
    expected: { normalized: 'CFTR:p.G542Ter', variantType: 'stop-gain' },
  },
  {
    id: 26,
    hgvs: 'BRCA1:p.Q1756fs',
    tier: 'edge',
    note: 'Frameshift shorthand variant.',
    expected: { normalized: 'BRCA1:p.Q1756fs' },
  },
  {
    id: 27,
    hgvs: 'rs113488022',
    tier: 'edge',
    note: 'dbSNP-only input should fail gracefully.',
    expected: { apiShouldReject: true },
  },
  {
    id: 28,
    hgvs: 'NM_000492.4(CFTR):p.F508del',
    tier: 'edge',
    note: 'Transcript-prefixed CFTR should normalize correctly.',
    expected: {
      normalized: 'CFTR:p.F508del',
      transcript: 'NM_000492.4',
      expectedGene: 'CFTR',
    },
  },
  {
    id: 29,
    hgvs: 'APOE:p.C130R',
    tier: 'vus_benign',
    note: 'Common variant with nuanced clinical interpretation.',
    expected: { normalized: 'APOE:p.C130R' },
  },
  {
    id: 30,
    hgvs: 'RYR1:p.R2454H',
    tier: 'obscure',
    note: 'Drug-response related ClinVar case.',
    expected: { normalized: 'RYR1:p.R2454H' },
  },
  {
    id: 31,
    hgvs: 'DMD:p.Q1*',
    tier: 'edge',
    note: 'Nonsense at start codon region in a very large protein.',
    expected: { normalized: 'DMD:p.Q1Ter', variantType: 'stop-gain' },
  },
  {
    id: 32,
    hgvs: 'TP53:p.R248Q',
    tier: 'famous',
    note: 'Additional p53 hotspot benchmark.',
    expected: {
      normalized: 'TP53:p.R248Q',
      domainShouldBeAnnotated: true,
      domainNameIncludes: 'dna',
    },
  },
  {
    id: 33,
    hgvs: 'MT-ND1:m.3460G>A',
    tier: 'edge',
    note: 'Mitochondrial nucleotide notation should be rejected.',
    expected: { apiShouldReject: true },
  },
  {
    id: 34,
    hgvs: 'CFTR:p.G542X',
    tier: 'edge',
    note: 'Legacy X stop notation - still common in older CF literature.',
    expected: {
      expectedStatus: 200,
      normalized: 'CFTR:p.G542Ter',
      variantType: 'stop-gain',
    },
  },
  {
    id: 35,
    hgvs: 'CFTR:p.Gly542Ter',
    tier: 'edge',
    note: 'Three-letter + Ter stop notation - HGVS strict form.',
    expected: {
      expectedStatus: 200,
      normalized: 'CFTR:p.G542Ter',
      variantType: 'stop-gain',
    },
  },
  {
    id: 36,
    hgvs: 'MYH7:p.R403Q',
    tier: 'famous',
    note: 'Classic hypertrophic cardiomyopathy mutation with strong evidence.',
    expected: {
      expectedStatus: 200,
      normalized: 'MYH7:p.R403Q',
      domainShouldBeAnnotated: true,
      clinicalShouldBePathogenicOrLikely: true,
    },
  },
  {
    id: 37,
    hgvs: 'TP53:p.M1V',
    tier: 'edge',
    note: 'Residue 1 boundary test at protein start.',
    expected: {
      expectedStatus: 200,
      normalized: 'TP53:p.M1V',
      residue: 1,
      isValidPosition: true,
    },
  },
  {
    id: 38,
    hgvs: 'CFTR:p.L1480P',
    tier: 'edge',
    note: 'Upper boundary test at final CFTR residue.',
    expected: {
      expectedStatus: 200,
      normalized: 'CFTR:p.L1480P',
      residue: 1480,
      isValidPosition: true,
    },
  },
  {
    id: 39,
    hgvs: 'CFTR:p.L1481P',
    tier: 'edge',
    note: 'One past final residue must be rejected.',
    expected: {
      expectedStatus: 400,
      apiShouldReject: true,
      apiErrorCode: 'INVALID_POSITION',
      errorContains: 'exceeds',
    },
  },
  {
    id: 40,
    hgvs: 'BRCA2:p.Y3308dup',
    tier: 'edge',
    note: 'Single-residue duplication class coverage.',
    expected: {
      expectedStatus: 200,
      normalized: 'BRCA2:p.Y3308dup',
      variantType: 'duplication',
    },
  },
  {
    id: 41,
    hgvs: 'BRCA1:p.M1775R',
    tier: 'famous',
    note: 'Known pathogenic BRCA1 BRCT-domain missense.',
    expected: {
      expectedStatus: 200,
      normalized: 'BRCA1:p.M1775R',
      domainShouldBeAnnotated: true,
      domainNameIncludes: 'brct',
    },
  },
  {
    id: 42,
    hgvs: 'OBSCN:p.R4344Q',
    tier: 'obscure',
    note: 'Sparse-data giant-protein scenario should degrade gracefully.',
    expected: {
      expectedStatus: 200,
      normalized: 'OBSCN:p.R4344Q',
      unknownSeverityDefined: true,
    },
  },
  {
    id: 43,
    hgvs: 'LDLR:p.G544V',
    tier: 'famous',
    note: 'Familial hypercholesterolemia cardiology variant.',
    expected: {
      expectedStatus: 200,
      normalized: 'LDLR:p.G544V',
      clinicalShouldBePathogenicOrLikely: true,
    },
  },
  {
    id: 44,
    hgvs: 'COL1A1:p.G1003V',
    tier: 'obscure',
    note: 'Collagen repeat-domain domain-mapping stress test.',
    expected: {
      expectedStatus: 200,
      normalized: 'COL1A1:p.G1003V',
      domainShouldBeAnnotated: true,
    },
  },
  {
    id: 45,
    hgvs: 'TSC2:p.R611Q',
    tier: 'obscure',
    note: 'TSC2/TSC1 mislabel trap.',
    expected: {
      expectedStatus: 200,
      normalized: 'TSC2:p.R611Q',
      expectedGene: 'TSC2',
      mustNotGene: 'TSC1',
    },
  },
  {
    id: 46,
    hgvs: 'LMNA:p.R527P',
    tier: 'obscure',
    note: 'Laminopathy variant with domain context.',
    expected: {
      expectedStatus: 200,
      normalized: 'LMNA:p.R527P',
      domainShouldBeAnnotated: true,
    },
  },
  {
    id: 47,
    hgvs: 'GBA:p.N409S',
    tier: 'famous',
    note: 'Common Gaucher disease variant.',
    expected: {
      expectedStatus: 200,
      normalized: 'GBA:p.N409S',
      clinicalShouldBePathogenicOrLikely: true,
    },
  },
  {
    id: 48,
    hgvs: 'PTEN:p.R130Q',
    tier: 'famous',
    note: 'PTEN phosphatase-domain hotspot-adjacent variant.',
    expected: {
      expectedStatus: 200,
      normalized: 'PTEN:p.R130Q',
      domainShouldBeAnnotated: true,
      clinicalShouldBePathogenicOrLikely: true,
    },
  },
  {
    id: 49,
    hgvs: 'NOTCH1:p.R1279H',
    tier: 'obscure',
    note: 'Large multi-domain receptor domain extraction check.',
    expected: {
      expectedStatus: 200,
      normalized: 'NOTCH1:p.R1279H',
      domainShouldBeAnnotated: true,
    },
  },
  {
    id: 50,
    hgvs: 'CFTR:p.=',
    tier: 'edge',
    note: 'No-change p.= should be rejected gracefully.',
    expected: {
      expectedStatus: 400,
      apiShouldReject: true,
      errorContains: 'invalid hgvs',
    },
  },
  {
    id: 51,
    hgvs: 'TP53:p.R175H p.R248Q',
    tier: 'edge',
    note: 'Two variants in one input should be rejected cleanly.',
    expected: {
      expectedStatus: 400,
      apiShouldReject: true,
      errorContains: 'one protein variant',
    },
  },
  {
    id: 52,
    hgvs: 'BRCA1:p.Q1756fs',
    tier: 'edge',
    note: 'Idempotency check on repeated request (deterministic consistency).',
    expected: {
      expectedStatus: 200,
      normalized: 'BRCA1:p.Q1756fs',
      repeatCallShouldMatch: true,
    },
  },
  {
    id: 53,
    hgvs: 'FBN1:p.C1663R',
    tier: 'famous',
    note: 'Marfan syndrome cbEGF-repeat variant.',
    expected: {
      expectedStatus: 200,
      normalized: 'FBN1:p.C1663R',
      domainShouldBeAnnotated: true,
      clinicalShouldBePathogenicOrLikely: true,
    },
  },
];

export const getGoldenCasesByTier = (tier: GoldenCaseTier) =>
  GOLDEN_CASES.filter((c) => c.tier === tier);

Object.freeze(GOLDEN_CASES);
GOLDEN_CASES.forEach((c) => Object.freeze(c));
