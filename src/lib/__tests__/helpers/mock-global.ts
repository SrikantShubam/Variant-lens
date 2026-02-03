// Centralized mock setup - idempotent, safe to call from any test file
// Uses manual mocks (no MSW) for Jest compatibility

import { jest } from '@jest/globals';

declare global {
  var __MOCKS_READY__: boolean;
}

// Import manual mock implementations
import { mockFetch, mockOpenAI } from '../mocks/external-apis';

/**
 * Ensure all mocks are applied. Safe to call multiple times (idempotent).
 */
export function ensureMocks(): void {
  // Set required env vars
  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-key';
  
  if (!global.__MOCKS_READY__) {
    mockFetch();
    mockOpenAI();
    global.__MOCKS_READY__ = true;
  }
}

/**
 * Reset all mocks between tests (clears call history, not implementations)
 */
export function resetMocks(): void {
  jest.clearAllMocks();
}

/**
 * Cleanup all mocks after test suite
 */
export function cleanupMocks(): void {
  jest.restoreAllMocks();
  global.__MOCKS_READY__ = false;
}
