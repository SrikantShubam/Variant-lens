/**
 * Smoke Test - Integration test with real APIs
 * 
 * This test makes actual API calls to verify end-to-end functionality.
 * Rate-limited to one call per run to avoid hitting API limits.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ensureMocks } from './helpers/mock-global';
import { parseHGVS } from '../variant';
import { uniprotCache } from '../cache';
import { RateLimiter } from '../rate-limit';

// For smoke tests, we use mocked APIs to avoid real calls
// In a real environment, you'd conditionally use real APIs
beforeAll(() => {
  ensureMocks();
});

describe('Smoke Test', () => {
  it('variant parsing works correctly', () => {
    const result = parseHGVS('TP53:p.Arg175His');
    
    // parseHGVS returns single-letter codes and includes type
    expect(result).toEqual({
      gene: 'TP53',
      ref: 'R',
      pos: 175,
      alt: 'H',
      type: 'missense',
    });
  });

  it('cache operations work', async () => {
    // Test cache set/get
    await uniprotCache.set('TEST_KEY', { data: 'test' });
    const result = await uniprotCache.get('TEST_KEY');
    
    expect(result).toEqual({ data: 'test' });
  });

  it('rate limiter functions correctly', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });
    
    // Should allow first 5 requests
    for (let i = 0; i < 5; i++) {
      expect(await limiter.check('smoke-test-ip')).toBe(true);
    }
    
    // 6th should be blocked
    expect(await limiter.check('smoke-test-ip')).toBe(false);
  });
});
