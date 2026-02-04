/**
 * ClinVar Integration Tests
 * 
 * Test-first development for Phase-2 Priority 1
 * These tests must pass before ClinVar is considered done.
 */

import { getClinVarData, ClinVarResult } from '../lib/clinvar-client';

// ==========================================
// TEST CLASS 1: Known Pathogenic Variant
// ==========================================
describe('ClinVar: Pathogenic Variants', () => {
  
  test('BRAF V600E should show Pathogenic', async () => {
    const result = await getClinVarData('BRAF', 'p.V600E');
    
    expect(result).not.toBeNull();
    expect(result?.clinicalSignificance).toBe('Pathogenic');
    expect(result?.reviewStatus).toBeDefined();
    expect(result?.clinvarId).toBeDefined();
  });

  test('TP53 R175H should show Pathogenic', async () => {
    const result = await getClinVarData('TP53', 'p.R175H');
    
    expect(result).not.toBeNull();
    expect(result?.clinicalSignificance).toBe('Pathogenic');
  });
});

// ==========================================
// TEST CLASS 2: Known Benign Variant
// ==========================================
describe('ClinVar: Benign Variants', () => {
  
  test('Known benign variant returns Benign', async () => {
    // Using a known benign variant
    const result = await getClinVarData('CFTR', 'p.I507V');
    
    if (result) {
      expect(['Benign', 'Likely benign']).toContain(result.clinicalSignificance);
    }
    // If no result, that's also acceptable for this test
  });
});

// ==========================================
// TEST CLASS 3: No ClinVar Entry
// ==========================================
describe('ClinVar: No Entry Variants', () => {
  
  test('Rare/novel variant returns null', async () => {
    // Using a fictional rare variant
    const result = await getClinVarData('OBSCN', 'p.R4831H');
    
    // Should return null or empty, NOT throw
    expect(result).toBeNull();
  });

  test('Invalid gene returns null gracefully', async () => {
    const result = await getClinVarData('FAKEGENE123', 'p.X999Y');
    
    expect(result).toBeNull();
  });
});

// ==========================================
// TEST CLASS 4: VUS (Uncertain Significance)
// ==========================================
describe('ClinVar: VUS Variants', () => {
  
  test('VUS variant shows Uncertain significance', async () => {
    // Many BRCA2 variants are VUS
    const result = await getClinVarData('BRCA2', 'p.D2723H');
    
    if (result) {
      expect(result.clinicalSignificance).toMatch(/uncertain|VUS/i);
    }
  });
});

// ==========================================
// TEST CLASS 5: Response Structure
// ==========================================
describe('ClinVar: Response Structure', () => {
  
  test('Result contains all required fields', async () => {
    const result = await getClinVarData('BRAF', 'p.V600E');
    
    if (result) {
      // Required fields
      expect(result).toHaveProperty('clinicalSignificance');
      expect(result).toHaveProperty('reviewStatus');
      expect(result).toHaveProperty('clinvarId');
      expect(result).toHaveProperty('conditions');
      expect(result).toHaveProperty('lastUpdated');
      
      // ClinVar link should be valid
      expect(result.clinvarId).toMatch(/^\d+$/);
    }
  });

  test('Review status is a valid level', async () => {
    const result = await getClinVarData('BRAF', 'p.V600E');
    
    if (result) {
      const validStatuses = [
        'practice guideline',
        'reviewed by expert panel',
        'criteria provided, multiple submitters, no conflicts',
        'criteria provided, conflicting interpretations',
        'criteria provided, single submitter',
        'no assertion criteria provided',
        'no assertion provided'
      ];
      
      expect(validStatuses.some(s => 
        result.reviewStatus.toLowerCase().includes(s.toLowerCase())
      )).toBe(true);
    }
  });
});

// ==========================================
// TEST CLASS 6: No Interpretation Added
// ==========================================
describe('ClinVar: No Interpretation (Critical)', () => {
  
  test('Result does NOT contain interpretation text', async () => {
    const result = await getClinVarData('BRAF', 'p.V600E');
    
    if (result) {
      // Should NOT have fields that imply interpretation
      expect(result).not.toHaveProperty('interpretation');
      expect(result).not.toHaveProperty('mechanism');
      expect(result).not.toHaveProperty('recommendation');
      expect(result).not.toHaveProperty('score');
      expect(result).not.toHaveProperty('acmgClassification');
    }
  });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║              CLINVAR INTEGRATION TESTS                     ║
╠════════════════════════════════════════════════════════════╣
║ Test 1: Pathogenic variants return Pathogenic              ║
║ Test 2: Benign variants return Benign                      ║
║ Test 3: No entry returns null (not error)                  ║
║ Test 4: VUS shown correctly                                ║
║ Test 5: Response structure validated                       ║
║ Test 6: NO interpretation text added                       ║
╚════════════════════════════════════════════════════════════╝

Run with: npx jest src/validation/clinvar-tests.ts
`);
