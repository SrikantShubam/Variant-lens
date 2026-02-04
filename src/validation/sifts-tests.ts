/**
 * SIFTS Mapping Tests
 * 
 * Phase-2 Priority 3: Residue Mapping (UniProt <-> PDB)
 * 
 * CONSTRAINTS:
 * - Deterministic mapping only (SIFTS source)
 * - Explicit failure when unmapped
 * - No structural inference or distance calculation
 */

import { getSiftsMapping, SiftsResult } from '../lib/sifts-client';

// ==========================================
// TEST CLASS 1: Well-Known Structure (Positive Control)
// ==========================================
describe('SIFTS: Known Mappings', () => {
  
  test('EGFR 858 maps to PDB 2ITX channel A', async () => {
    // L858R is a classic EGFR variant
    const result = await getSiftsMapping('P00533', 858, '2ITX');
    
    expect(result).not.toBeNull();
    if (result) {
      expect(result.pdbId).toBe('2ITX');
      expect(result.chain).toBe('A');
      expect(result.pdbResidue).toBeDefined(); // Might differ from 858 due to numbering
      expect(result.source).toBe('PDBe-KB');
    }
  });

  test('BRAF 600 maps to PDB', async () => {
    const result = await getSiftsMapping('P15056', 600, '4MNE'); // 4MNE is a BRAF structure
    
    expect(result).not.toBeNull();
    if (result) {
      expect(result.mapped).toBe(true);
    }
  });
});

// ==========================================
// TEST CLASS 2: Unmapped Region (Negative Control)
// ==========================================
describe('SIFTS: Unmapped Regions', () => {
  
  test('Terminus residue returns unmapped', async () => {
    // Often N/C-termini are missing from crystal structures
    // BRAF N-terminus is disordered
    const result = await getSiftsMapping('P15056', 10, '4MNE'); 
    
    // Result might be null OR explicit unmapped object depending on implementation
    if (result) {
      expect(result.mapped).toBe(false);
      expect(result.note).toMatch(/not mapped/i);
    } else {
      expect(result).toBeNull();
    }
  });
});

// ==========================================
// TEST CLASS 3: Structure Mismatch
// ==========================================
describe('SIFTS: Mismatch Handling', () => {
  
  test('Requesting non-existent PDB returns null', async () => {
    const result = await getSiftsMapping('P00533', 858, 'XXXX');
    
    expect(result).toBeNull();
  });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║              SIFTS MAPPING TESTS                           ║
╠════════════════════════════════════════════════════════════╣
║ Test 1: Known residues map correctly (EGFR 858)            ║
║ Test 2: Disordered regions return unmapped                 ║
║ Test 3: Invalid PDB requests return null gracefully        ║
╚════════════════════════════════════════════════════════════╝

Run with: npx tsx src/validation/sifts-tests.ts (after client impl)
`);
