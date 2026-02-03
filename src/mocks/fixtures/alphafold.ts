export const alphaFoldFixtures: Record<string, any> = {
  // TP53
  P04637: {
    entryId: 'AF-P04637-F1',
    gene: 'TP53',
    sequenceVersionDate: '2024-01-01',
    sequence: 'MEEPQSDPSIEP...', // truncated
    uniprotAccession: 'P04637',
    uniprotId: 'P53_HUMAN',
    uniprotDescription: 'Cellular tumor antigen p53',
    taxId: 9606,
    organismScientificName: 'Homo sapiens',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.pdb',
    cifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif',
    bcifUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.bcif',
    paeImageUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v4.png',
    paeDocUrl: 'https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v4.json',
    amAnnotationsUrl: null,
    amAnnotationsHg19Url: null,
    amAnnotationsHg38Url: null,
    plddt: Array(393).fill(0).map((_, i) => {
      // Simulate high confidence with some low regions
      if (i < 100) return 95 + Math.random() * 5;
      if (i > 300) return 90 + Math.random() * 8;
      return 75 + Math.random() * 15; // DNA binding domain variable
    }),
    maxPae: 12.5,
    ptm: 0.89,
    coverage: [
      {
        entryDb: 'UNIPROT',
        entryId: 'P04637',
        entryChain: 'A',
        seqStart: 1,
        seqEnd: 393,
        coverage: 1.0,
      },
    ],
  },

  // BRCA1
  P38398: {
    entryId: 'AF-P38398-F1',
    gene: 'BRCA1',
    uniprotAccession: 'P38398',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P38398-F1-model_v4.pdb',
    plddt: Array(1863).fill(0).map((_, i) => {
      // RING domain high confidence, disordered regions low
      if (i < 109) return 92 + Math.random() * 6; // RING
      if (i > 1600) return 85 + Math.random() * 10; // BRCT
      return 45 + Math.random() * 30; // Disordered middle
    }),
    maxPae: 28.5,
    ptm: 0.52,
    coverage: [{ entryDb: 'UNIPROT', entryId: 'P38398', seqStart: 1, seqEnd: 1863 }],
  },

  // CFTR (membrane protein, lower confidence)
  P13569: {
    entryId: 'AF-P13569-F1',
    gene: 'CFTR',
    uniprotAccession: 'P13569',
    pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-P13569-F1-model_v4.pdb',
    plddt: Array(1480).fill(0).map((_, i) => {
      // Transmembrane domains okay, loops variable
      return 60 + Math.random() * 30;
    }),
    maxPae: 25.0,
    ptm: 0.61,
    coverage: [{ entryDb: 'UNIPROT', entryId: 'P13569', seqStart: 1, seqEnd: 1480 }],
  },

  // Error case
  INVALID: null,
};

// For testing pLDDT color mapping
export const plddtCategories = {
  veryHigh: { min: 90, color: '#0053d6', label: 'Very high (pLDDT > 90)' },
  high: { min: 70, max: 90, color: '#65cbf3', label: 'High (90 > pLDDT > 70)' },
  low: { min: 50, max: 70, color: '#ffdb13', label: 'Low (70 > pLDDT > 50)' },
  veryLow: { max: 50, color: '#ff7d45', label: 'Very low (pLDDT < 50)' },
};
