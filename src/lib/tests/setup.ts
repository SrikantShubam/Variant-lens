// Global test setup
import { jest } from '@jest/globals';

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.UPSTASH_REDIS_REST_URL = 'test-redis';
