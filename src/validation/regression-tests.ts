/**
 * PHASE-1 REGRESSION TESTS
 * 
 * Critical tests that MUST pass before release:
 * 1. Limitations never empty when coverage missing
 * 2. Invalid positions rejected
 * 3. Domain extraction matches UniProt
 */

import { 
  TEST_DATASET, 
  getPositiveCases, 
  getNegativeNoDatCases,
  getInvalidPositionCases,
} from './test-dataset';

// ==========================================
// REGRESSION TEST 1: Limitations never empty
// ==========================================
describe('Regression: Evidence Limitations', () => {
  
  test('If any coverage field is "none", limitations array MUST be non-empty', async () => {
    for (const variant of getNegativeNoDatCases()) {
      const response = await analyzeVariantHonestly(variant.hgvs);
      
      // Check if any coverage is missing
      const structureMissing = response.coverage.structure.status === 'none';
      const clinicalMissing = response.coverage.clinical.status === 'none';
      const domainMissing = !response.coverage.domain.inAnnotatedDomain;
      const literatureMissing = response.coverage.literature.variantSpecificCount === 0;
      
      const anyCoverageMissing = structureMissing || clinicalMissing || domainMissing || literatureMissing;
      
      if (anyCoverageMissing) {
        expect(response.unknowns.items.length).toBeGreaterThan(0);
        // This ensures the tool never silently hides missing data
      }
    }
  });

  test('Limitations array is NEVER empty for negative controls', async () => {
    for (const variant of getNegativeNoDatCases()) {
      const response = await analyzeVariantHonestly(variant.hgvs);
      
      // For no-data variants, there MUST be limitations
      expect(response.unknowns.items.length).toBeGreaterThan(0);
      
      // This test fails if limitations disappear due to a bug
    }
  });
});

// ==========================================
// REGRESSION TEST 2: Invalid positions rejected
// ==========================================
describe('Regression: Position Validation', () => {
  
  test.each(getInvalidPositionCases())(
    '$hgvs MUST fail with INVALID_POSITION error',
    async (variant) => {
      await expect(
        analyzeVariantHonestly(variant.hgvs)
      ).rejects.toThrow(/invalid|exceeds|out of range/i);
    }
  );
});

// ==========================================
// REGRESSION TEST 3: Domain extraction accuracy
// ==========================================
describe('Regression: Domain Extraction', () => {
  
  test('JAK2:p.V617F must detect Protein kinase domain', async () => {
    const response = await analyzeVariantHonestly('JAK2:p.V617F');
    
    expect(response.curatedInfo.variantInDomain).not.toBeNull();
    expect(response.curatedInfo.variantInDomain.toLowerCase()).toContain('kinase');
  });

  test('BRAF:p.V600E must detect Protein kinase domain', async () => {
    const response = await analyzeVariantHonestly('BRAF:p.V600E');
    
    expect(response.curatedInfo.variantInDomain).not.toBeNull();
    expect(response.curatedInfo.variantInDomain.toLowerCase()).toContain('kinase');
  });

  test('TP53:p.R175H must detect DNA-binding domain', async () => {
    const response = await analyzeVariantHonestly('TP53:p.R175H');
    
    expect(response.curatedInfo.variantInDomain).not.toBeNull();
    expect(response.curatedInfo.variantInDomain.toLowerCase()).toMatch(/dna|binding/);
  });
});

// ==========================================
// REGRESSION TEST 4: API response structure
// ==========================================
describe('Regression: API Response Structure', () => {
  
  test('Response must include all required fields', async () => {
    const response = await analyzeVariantHonestly('JAK2:p.V617F');
    
    // Required fields
    expect(response).toHaveProperty('variant.hgvs');
    expect(response).toHaveProperty('variant.gene');
    expect(response).toHaveProperty('coverage.structure.status');
    expect(response).toHaveProperty('coverage.clinical.status');
    expect(response).toHaveProperty('coverage.domain.inAnnotatedDomain');
    expect(response).toHaveProperty('coverage.literature.variantSpecificCount');
    expect(response).toHaveProperty('unknowns.items');
    expect(response).toHaveProperty('curatedInfo.proteinLength');
    expect(response).toHaveProperty('summary.text');
    expect(response).toHaveProperty('summary.disclaimer');
  });

  test('Disclaimer must mention "research use"', async () => {
    const response = await analyzeVariantHonestly('JAK2:p.V617F');
    
    expect(response.summary.disclaimer.toLowerCase()).toContain('research');
  });
});

// ==========================================
// STUB - Replace with real API call
// ==========================================

async function analyzeVariantHonestly(hgvs: string): Promise<any> {
  const response = await fetch('http://localhost:3000/api/variant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hgvs }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'API Error');
  }
  
  return response.json();
}

// ==========================================
// RUN INFO
// ==========================================
console.log(`
╔════════════════════════════════════════════════════════════╗
║              PHASE-1 REGRESSION TESTS                      ║
╠════════════════════════════════════════════════════════════╣
║ Test 1: Limitations never empty when coverage missing      ║
║ Test 2: Invalid positions rejected with clear error        ║
║ Test 3: Domain extraction matches UniProt ground truth     ║
║ Test 4: API response structure validated                   ║
╚════════════════════════════════════════════════════════════╝

Run with: npx jest src/validation/regression-tests.ts
`);
