import { describe, it, expect } from '@jest/globals';
import { parseHGVS, normalizeVariant, validateHGVS } from '../variant';

describe('Variant Normalization', () => {
  describe('parseHGVS', () => {
    it('parses valid protein HGVS', () => {
      const result = parseHGVS('BRCA1:p.Cys61Gly');
      expect(result).toEqual({
        gene: 'BRCA1',
        ref: 'C',
        pos: 61,
        alt: 'G',
        type: 'missense'
      });
    });

    it('parses substitution with 3-letter code', () => {
      const result = parseHGVS('TP53:p.Arg175His');
      expect(result.pos).toBe(175);
      expect(result.ref).toBe('R');
      expect(result.alt).toBe('H');
    });

    it('rejects invalid format', () => {
      expect(() => parseHGVS('invalid')).toThrow('Invalid HGVS format');
      expect(() => parseHGVS('BRCA1')).toThrow('Invalid HGVS format');
      expect(() => parseHGVS('BRCA1:123')).toThrow('Invalid HGVS format');
    });

    it('rejects nucleotide HGVS', () => {
      expect(() => parseHGVS('BRCA1:c.61C>G')).toThrow('Protein HGVS required');
    });

    it('handles stop codons', () => {
      const result = parseHGVS('CFTR:p.Arg117His');
      expect(result.alt).toBe('H');
    });
  });

  describe('normalizeVariant', () => {
    it('converts 3-letter to 1-letter code', () => {
      const result = normalizeVariant('BRCA1:p.Cys61Gly');
      expect(result.normalized).toBe('BRCA1:p.C61G');
    });

    it('validates amino acid codes', () => {
      expect(() => normalizeVariant('BRCA1:p.Xyz61Gly')).toThrow('Invalid amino acid');
    });
  });
});
