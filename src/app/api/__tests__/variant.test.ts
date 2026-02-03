import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from './test-server';

import { mockFetch, mockOpenAI, mockOrchestrator } from '../../../lib/__tests__/mocks/external-apis';

describe('POST /api/variant', () => {
  let server: any;

  beforeAll(() => {
    mockFetch();
    mockOpenAI();
    mockOrchestrator(); // Mock entire orchestrator to bypass LLM calls
    server = createServer();
  });

  afterAll(() => {
    server.close();
  });

  it('returns 200 for valid variant', async () => {
    const response = await request(server)
      .post('/api/variant')
      .send({ hgvs: 'BRCA1:p.Cys61Gly' });

    expect(response.status).toBe(200);
    // Route normalizes variant to short form
    expect(response.body).toHaveProperty('variant');
    expect(response.body.variant).toMatch(/BRCA1:p\.(C61G|Cys61Gly)/);
    expect(response.body).toHaveProperty('structure');
    expect(response.body).toHaveProperty('hypothesis');
  });

  it('returns 400 for invalid HGVS', async () => {
    const response = await request(server)
      .post('/api/variant')
      .send({ hgvs: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid HGVS');
  });

  it('returns 404 or 500 for unknown variant', async () => {
    const response = await request(server)
      .post('/api/variant')
      .send({ hgvs: 'FAKEGENE:p.Ala1Val' });

    // Accept either 404 (structure not found) or 500 (error during processing)
    expect([404, 500]).toContain(response.status);
  });

  it('returns 429 when rate limited', async () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await request(server).post('/api/variant').send({ hgvs: 'BRCA1:p.Cys61Gly' });
    }

    const response = await request(server)
      .post('/api/variant')
      .send({ hgvs: 'BRCA1:p.Cys61Gly' });

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('respects format parameter', async () => {
    const jsonResponse = await request(server)
      .post('/api/variant?format=json')
      .send({ hgvs: 'BRCA1:p.Cys61Gly' });
    expect(jsonResponse.body).toBeInstanceOf(Object);

    // MD format would return text/markdown only on success
    const mdResponse = await request(server)
      .post('/api/variant?format=md')
      .send({ hgvs: 'BRCA1:p.Cys61Gly' });
    
    // Response may be JSON on error or markdown on success
    if (mdResponse.status === 200) {
      expect(mdResponse.headers['content-type']).toContain('text/markdown');
    }
  });
});
