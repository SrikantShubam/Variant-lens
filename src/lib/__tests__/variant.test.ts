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

    it('parses transcript-prefixed HGVS with gene in parentheses', () => {
      const result = parseHGVS('NM_152416.4(NDUFAF6):p.Ala178Pro');
      expect(result.gene).toBe('NDUFAF6');
      expect(result.transcript).toBe('NM_152416.4');
      expect(result.ref).toBe('A');
      expect(result.pos).toBe(178);
      expect(result.alt).toBe('P');
    });

    it('parses lowercase and extra spaces', () => {
      const result = parseHGVS(' tp53 : p. r175h ');
      expect(result.gene).toBe('TP53');
      expect(result.ref).toBe('R');
      expect(result.pos).toBe(175);
      expect(result.alt).toBe('H');
    });

    it('parses gene-prefixed form without explicit p. marker', () => {
      const result = parseHGVS('BRAF:V600E');
      expect(result.gene).toBe('BRAF');
      expect(result.ref).toBe('V');
      expect(result.alt).toBe('E');
    });

    it('normalizes ABCC7 alias to CFTR', () => {
      const result = parseHGVS('ABCC7:p.F508del');
      expect(result.gene).toBe('CFTR');
      expect(result.ref).toBe('F');
      expect(result.alt).toBe('del');
    });

    it('returns a clear format error when ":" is missing', () => {
      expect(() => parseHGVS('NDUFAF6p.Ala178Pro')).toThrow('Missing ":" between gene and protein change');
    });

    it('parses frameshift protein HGVS', () => {
      const result = parseHGVS('BRCA2:p.Ser1982Argfs*22');
      expect(result.gene).toBe('BRCA2');
      expect(result.ref).toBe('S');
      expect(result.pos).toBe(1982);
      expect(result.alt).toBe('fs');
      expect(result.type).toBe('frameshift');
    });

    it('accepts stop-gain notation with *', () => {
      const result = parseHGVS('CFTR:p.G542*');
      expect(result.alt).toBe('*');
      expect(result.type).toBe('nonsense');
    });

    it('accepts stop-gain notation for single-position truncation hotspots', () => {
      const result = parseHGVS('DMD:p.Q1*');
      expect(result.alt).toBe('*');
      expect(result.type).toBe('nonsense');
    });

    it('accepts stop-gain notation with Ter', () => {
      const result = parseHGVS('CFTR:p.G542Ter');
      expect(result.alt).toBe('*');
      expect(result.type).toBe('nonsense');
    });

    it('accepts stop-gain notation with X', () => {
      const result = parseHGVS('CFTR:p.G542X');
      expect(result.alt).toBe('*');
      expect(result.type).toBe('nonsense');
    });

    it('rejects mitochondrial nucleotide HGVS', () => {
      expect(() => parseHGVS('MT-TL1:m.3243A>G')).toThrow('Protein HGVS required');
    });

    it('rejects c. notation', () => {
      expect(() => parseHGVS('CFTR:c.1521_1523delCTT')).toThrow('Protein HGVS required');
    });

    it('rejects p.= as unsupported no-change notation', () => {
      expect(() => parseHGVS('CFTR:p.=')).toThrow('p.= (no protein change) is not supported');
    });

    it('rejects inputs containing more than one protein variant token', () => {
      expect(() => parseHGVS('TP53:p.R175H p.R248Q')).toThrow('Only one protein variant per request is supported');
    });

    it('rejects rsID-only input with a clear message', () => {
      expect(() => parseHGVS('rs113488022')).toThrow('dbSNP rsIDs are not supported directly');
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

    it('normalizes frameshift variants to fs', () => {
      const result = normalizeVariant('BRCA2:p.Ser1982Argfs*22');
      expect(result.normalized).toBe('BRCA2:p.S1982fs');
    });

    it('preserves duplication token during normalization', () => {
      const result = normalizeVariant('BRCA2:p.Y3308dup');
      expect(result.normalized).toBe('BRCA2:p.Y3308dup');
      expect(result.parsed.type).toBe('duplication');
    });

    it('normalizes transcript-prefixed CFTR HGVS', () => {
      const result = normalizeVariant('NM_000492.4(CFTR):p.F508del');
      expect(result.normalized).toBe('CFTR:p.F508del');
      expect(result.parsed.transcript).toBe('NM_000492.4');
    });

    it('normalizes stop-gain variants to Ter form', () => {
      expect(normalizeVariant('CFTR:p.G542*').normalized).toBe('CFTR:p.G542Ter');
      expect(normalizeVariant('CFTR:p.G542X').normalized).toBe('CFTR:p.G542Ter');
      expect(normalizeVariant('CFTR:p.G542Ter').normalized).toBe('CFTR:p.G542Ter');
      expect(normalizeVariant('DMD:p.Q1*').normalized).toBe('DMD:p.Q1Ter');
    });
  });
});
