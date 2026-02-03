import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { RateLimiter } from '../rate-limit';

// Use fake timers for predictable time advancement
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('Rate Limiting', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, maxRequests: 10 });
  });

  it('allows requests under limit', async () => {
    for (let i = 0; i < 10; i++) {
      expect(await limiter.check('ip1')).toBe(true);
    }
  });

  it('blocks requests over limit', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('ip1');
    }
    expect(await limiter.check('ip1')).toBe(false);
  });

  it('resets after window', async () => {
    // Fill limit
    for (let i = 0; i < 10; i++) await limiter.check('ip1');
    
    // Advance time
    jest.advanceTimersByTime(60001);
    
    expect(await limiter.check('ip1')).toBe(true);
  });

  it('tracks different IPs separately', async () => {
    for (let i = 0; i < 10; i++) await limiter.check('ip1');
    expect(await limiter.check('ip2')).toBe(true);
  });
});
