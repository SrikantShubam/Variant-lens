export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async check(identifier: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry) {
      // First request
      this.store.set(identifier, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Check if window has reset
    if (now - entry.windowStart > this.config.windowMs) {
      this.store.set(identifier, {
        count: 1,
        windowStart: now,
      });
      return true;
    }

    // Check limit
    if (entry.count >= this.config.maxRequests) {
      return false;
    }

    // Increment
    entry.count++;
    return true;
  }

  getRetryAfter(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry) return 0;

    const now = Date.now();
    const resetTime = entry.windowStart + this.config.windowMs;
    return Math.max(0, Math.ceil((resetTime - now) / 1000));
  }

  // Cleanup old entries (call periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart > this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }

  // Reset (for testing)
  reset(): void {
    this.store.clear();
  }
}

// Global instances for different endpoints
export const variantRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

export const batchRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 2,
});

export const validationRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 100,
});
