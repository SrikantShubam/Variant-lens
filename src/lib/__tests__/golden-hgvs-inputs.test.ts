import { describe, expect, it } from '@jest/globals';
import { normalizeVariant, parseHGVS } from '../variant';
import { GOLDEN_CASES } from '../../validation/golden-cases';

describe('Golden HGVS parser cases', () => {
  it.each(
    GOLDEN_CASES.filter((c) => !!c.expected.normalized).map((c) => ({
      hgvs: c.hgvs,
      normalized: c.expected.normalized as string,
    }))
  )('normalizes $hgvs -> $normalized', ({ hgvs, normalized }) => {
    const result = normalizeVariant(hgvs);
    expect(result.normalized).toBe(normalized);
  });

  it('captures transcript for transcript-prefixed format', () => {
    const result = parseHGVS('NM_152416.4(NDUFAF6):p.Ala178Pro');
    expect(result.transcript).toBe('NM_152416.4');
    expect(result.gene).toBe('NDUFAF6');
  });

  it('marks synonymous substitutions as silent', () => {
    const result = parseHGVS('CFTR:p.I507I');
    expect(result.type).toBe('silent');
  });

  it('normalizes stop-gain symbols to Ter', () => {
    expect(normalizeVariant('CFTR:p.G542*').normalized).toBe('CFTR:p.G542Ter');
    expect(normalizeVariant('CFTR:p.G542X').normalized).toBe('CFTR:p.G542Ter');
  });
});
