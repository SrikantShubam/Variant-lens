import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from './test-server';
import { ensureMocks } from '../../../lib/__tests__/helpers/mock-global';

describe('Health Checks', () => {
  let server: any;

  beforeAll(() => {
    ensureMocks();
    server = createServer();
  });

  afterAll(() => {
    server.close();
  });

  it('GET /api/health returns ok', async () => {
    const response = await request(server).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version');
  });

  it('GET /api/ready returns service status', async () => {
    const response = await request(server).get('/api/ready');
    
    // We expect it to convert standard output to JSON
    // If external APIs are mocked to work, they should report "up"
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ready');
    expect(response.body.services).toHaveProperty('pdb', 'up');
    expect(response.body.services).toHaveProperty('uniprot', 'up');
  });
});
