import { describe, it, expect, beforeAll } from '@jest/globals';
import { compareToExpert, calculateAlignment } from '../alignment';
import curatedSet from '../curated_set.json';
import { ensureMocks } from '../../lib/__tests__/helpers/mock-global';
import { mockOrchestrator } from '../../lib/__tests__/mocks/external-apis';

// Ensure mocks are applied
beforeAll(() => {
  ensureMocks();
  mockOrchestrator();
});

describe('Validation Set Alignment', () => {
  it('all curated variants have required fields', () => {
    curatedSet.forEach((variant, idx) => {
      try {
        expect(variant).toHaveProperty('hgvs');
        expect(variant).toHaveProperty('expertHypothesis');
        expect(variant).toHaveProperty('expertConfidence');
        expect(variant.expertConfidence).toMatch(/high|moderate|low/);
      } catch (e) {
        console.error(`Variant ${idx} (${variant.hgvs}) failed validation:`, e);
        throw e;
      }
    });
  });

  it('alignment scoring works', () => {
    const expert = {
      mechanism: 'Loss of zinc coordination',
      confidence: 'high'
    };
    const agent = {
      mechanism: 'Disrupts zinc binding',
      confidence: 'moderate'
    };

    const score = calculateAlignment(expert, agent);
    expect(score.mechanismAgreement).toBe('partial');
    expect(score.confidenceCalibration).toBe('under');
  });

  it('achieves >75% agreement on curated set', async () => {
    const results = await Promise.all(
      curatedSet.map(v => compareToExpert(v.hgvs))
    );

    const good = results.filter(r => 
      r.agreement === 'full' || r.agreement === 'partial'
    );

    const percentage = (good.length / results.length) * 100;
    expect(percentage).toBeGreaterThan(75);
  });
});
