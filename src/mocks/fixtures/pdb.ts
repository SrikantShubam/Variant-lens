export const pdbFixtures: Record<string, any> = {
  // TP53
  P04637: {
    search: {
      result_set: [
        { identifier: '1TUP', score: 1.0 },
        { identifier: '1YCS', score: 0.9 },
        { identifier: '2AC0', score: 0.8 },
      ],
    },
    entries: {
      '1TUP': {
        rcsb_entry_container_identifiers: { entry_id: '1TUP' },
        rcsb_entry_info: {
          resolution_combined: [2.2],
          molecular_weight: { value: 45000 },
        },
        struct: {
          title: 'Structure of the p53 tumor suppressor-DNA complex',
        },
        rcsb_binding_affinity: [],
      },
      '1YCS': {
        rcsb_entry_container_identifiers: { entry_id: '1YCS' },
        rcsb_entry_info: {
          resolution_combined: [2.6],
        },
      },
      '2AC0': {
        rcsb_entry_container_identifiers: { entry_id: '2AC0' },
        rcsb_entry_info: {
          resolution_combined: [3.8], // Too low, should be filtered
        },
      },
    },
  },

  // BRCA1
  P38398: {
    search: {
      result_set: [
        { identifier: '1JNX', score: 1.0 },
        { identifier: '1T29', score: 0.95 },
      ],
    },
    entries: {
      '1JNX': {
        rcsb_entry_container_identifiers: { entry_id: '1JNX' },
        rcsb_entry_info: {
          resolution_combined: [2.25],
        },
        struct: {
          title: 'BRCA1 RING domain structure',
        },
      },
      '1T29': {
        rcsb_entry_container_identifiers: { entry_id: '1T29' },
        rcsb_entry_info: {
          resolution_combined: [2.0],
        },
      },
    },
  },

  // CFTR
  P13569: {
    search: {
      result_set: [], // No good PDB coverage, triggers AlphaFold fallback
    },
    entries: {},
  },

  // No structures available
  NOSTRUCT: {
    search: { result_set: [] },
    entries: {},
  },
};

// For testing coverage calculation
export const pdbCoverageScenarios = {
  fullCoverage: { start: 1, end: 393, variantPos: 175, covered: true },
  partialCoverage: { start: 1, end: 100, variantPos: 250, covered: false },
  noCoverage: { start: null, end: null, variantPos: 1, covered: false },
};
