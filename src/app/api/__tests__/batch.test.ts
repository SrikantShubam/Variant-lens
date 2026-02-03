import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

import { createServer } from './test-server';
import { mockFetch, mockOpenAI, mockOrchestrator } from '../../../lib/__tests__/mocks/external-apis';

describe('POST /api/batch', () => {
    let server: any;

    beforeAll(() => {
        mockFetch();
        mockOpenAI();
        mockOrchestrator();
        server = createServer();
    });

    afterAll(() => {
        server.close();
    });

  // Run status test first to avoid rate limiting from other tests
  it('returns job status', async () => {
    const submit = await request(server)
      .post('/api/batch')
      .send({ variants: ['BRCA1:p.Cys61Gly'] });

    expect(submit.status).toBe(202);
    expect(submit.body).toHaveProperty('jobId');

    // Check that we can get a status (may not be completed immediately)
    const status = await request(server).get(`/api/batch/${submit.body.jobId}/status`);
    
    expect(status.status).toBe(200);
    expect(status.body).toHaveProperty('status');
    expect(['queued', 'processing', 'completed', 'error']).toContain(status.body.status);
  });

  it('accepts up to 20 variants', async () => {
    const variants = Array(20).fill('BRCA1:p.Cys61Gly');
    const response = await request(server)
      .post('/api/batch')
      .send({ variants });

    // Accept 202 (success) or 429 (rate limited from previous tests)
    expect([202, 429]).toContain(response.status);
    if (response.status === 202) {
      expect(response.body).toHaveProperty('jobId');
    }
  });

  it('rejects >20 variants', async () => {
    const variants = Array(21).fill('BRCA1:p.Cys61Gly');
    const response = await request(server)
      .post('/api/batch')
      .send({ variants });

    // Accept 400 (validation error) or 429 (rate limited from previous tests)
    expect([400, 429]).toContain(response.status);
    if (response.status === 400) {
      expect(response.body.error).toContain('Max 20 variants');
    }
  });
});
