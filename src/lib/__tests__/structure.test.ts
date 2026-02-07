import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { resolveStructure, PDBResolver, AlphaFoldResolver, clearStructureCache } from '../structure';
import { ensureMocks } from './helpers/mock-global';

// Ensure mocks are applied
beforeAll(() => {
  ensureMocks();
});

beforeEach(() => {
  clearStructureCache();
});

describe('Structure Resolution', () => {
  describe('PDBResolver', () => {
    it('returns PDB list when experimental structure exists', async () => {
      const resolver = new PDBResolver();
      const results = await resolver.resolve('P04637', 175);
      console.log('Structure Result:', JSON.stringify(results, null, 2));

      expect(results).not.toBeNull();
      expect(results.length).toBeGreaterThan(0);
      
      const best = results[0];
      expect(best.source).toBe('PDB');
      expect(best.id).toMatch(/^\d[A-Z0-9]{3}$/);
      expect(best.resolution).toBeLessThan(4.0);
      expect(best.experimental).toBe(true);
    });

    it('returns empty array when no PDB coverage', async () => {
      const resolver = new PDBResolver();
      const results = await resolver.resolve('NEW_GENE', 1);
      expect(results).toEqual([]);
    });

    it('handles PDB API failure gracefully', async () => {
      // Mock failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      
      const resolver = new PDBResolver();
      // Should result in empty array or throw depending on implementation?
      // structure.ts catches error and logs?
      // PDBResolver.resolve catches error? 
      // PDBResolver implementation: catch (error) { ... throw new Error('PDB unavailable'); }
      await expect(resolver.resolve('P04637', 175)).rejects.toThrow('PDB unavailable');
    });
  });

  describe('AlphaFoldResolver', () => {
    it('returns AlphaFold structure when available', async () => {
      const resolver = new AlphaFoldResolver();
      const result = await resolver.resolve('P04637');
      
      if (!result) throw new Error('Result should not be null');
      expect(result.source).toBe('AlphaFold');
      expect(result.id).toBe('AF-P04637-F1');
      expect(result.plddt).toBeDefined();
      expect(result.experimental).toBe(false);
    });
  });

  describe('resolveStructure (hierarchy)', () => {
    it('prefers PDB over AlphaFold', async () => {
      const result = await resolveStructure('P04637', 175);
      if (!result.best) throw new Error('Best structure should not be null');
      expect(result.best.source).toBe('PDB');
    });

    it('falls back to AlphaFold when no PDB', async () => {
      // Mock PDB to return empty array
      jest.spyOn(PDBResolver.prototype, 'resolve').mockResolvedValue([]);
      
      const result = await resolveStructure('P04637', 175);
      if (!result.best) throw new Error('Best structure should not be null');
      expect(result.best.source).toBe('AlphaFold');
    });

    it('throws when neither available', async () => {
      jest.spyOn(PDBResolver.prototype, 'resolve').mockResolvedValue([]);
      jest.spyOn(AlphaFoldResolver.prototype, 'resolve').mockRejectedValue(new Error('not found'));
      
      await expect(resolveStructure('INVALID', 1)).rejects.toThrow('No structure found');
    });

    it('caches results', async () => {
      const spy = jest.spyOn(global, 'fetch');
      await resolveStructure('P04637', 175);
      await resolveStructure('P04637', 175); // Second call
      
      // Should only fetch once due to cache
      // Note: PDB cache checks first.
      expect(spy).toHaveBeenCalledTimes(1); 
    });
  });
});
