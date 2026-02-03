import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Cache } from '../cache';

describe('Cache', () => {
  let cache: Cache<string>;

  beforeEach(() => {
    cache = new Cache<string>(1); // 1 second default TTL
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and retrieves values', () => {
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('returns null for missing keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns null for expired keys', () => {
    cache.set('key', 'value');
    jest.advanceTimersByTime(1100); // 1.1s
    expect(cache.get('key')).toBeNull();
  });

  it('respects custom TTL', () => {
    cache.set('key', 'value', 10); // 10 seconds
    jest.advanceTimersByTime(5000);
    expect(cache.get('key')).toBe('value');
    
    jest.advanceTimersByTime(6000);
    expect(cache.get('key')).toBeNull();
  });

  it('deletes keys', () => {
    cache.set('key', 'value');
    cache.delete('key');
    expect(cache.get('key')).toBeNull();
  });

  it('clears all keys', () => {
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('cleans up expired keys', () => {
    cache.set('k1', 'v1', 1);
    cache.set('k2', 'v2', 5);
    
    jest.advanceTimersByTime(2000);
    const cleaned = cache.cleanup();
    
    expect(cleaned).toBe(1);
    expect(cache.size()).toBe(1);
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBe('v2');
  });
});
