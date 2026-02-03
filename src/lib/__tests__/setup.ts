import { afterEach, afterAll, jest, beforeAll } from '@jest/globals';
import { ensureMocks, resetMocks, cleanupMocks } from './helpers/mock-global';

// Apply all mocks before tests run
beforeAll(() => {
  ensureMocks();
});

// Reset mocks after each test to ensure isolation
afterEach(() => {
  resetMocks();
});

// Cleanup after all tests complete
afterAll(() => {
  cleanupMocks();
});

// Global test timeout
jest.setTimeout(15000);

// Suppress specific console errors
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (/Warning.*not wrapped in act/.test(args[0])) return;
    if (/UniProt fetch failed/.test(args[0])) return; // Expected in tests
    originalError.call(console, ...args);
  };
});
