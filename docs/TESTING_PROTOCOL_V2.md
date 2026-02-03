# Testing Protocol V2: Test-First Backend

## Philosophy

**Red-Green-Refactor. No exceptions.**

Every feature:
1. Write failing test (Red)
2. Implement minimal code to pass (Green)
3. Refactor (Refactor)

No frontend code until backend test suite passes 100%.

## Test Directory Structure
```
src/
├── lib/
│   ├── tests/           # Unit tests
│   │   ├── variant.test.ts
│   │   ├── structure.test.ts
│   │   ├── agents.test.ts
│   │   ├── rate-limit.test.ts
│   │   └── cache.test.ts
│   └── ...                  # Implementation
├── app/
│   └── api/
│       ├── tests/       # Integration tests
│       │   ├── variant.test.ts
│       │   ├── batch.test.ts
│       │   └── health.test.ts
│       └── ...              # API routes
└── validation/
    └── tests/           # Validation set tests
        └── alignment.test.ts
```

## Backend Test Suite (Implement These First)

### 1. Variant Normalization Tests
**File:** `src/lib/__tests__/variant.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { parseHGVS, normalizeVariant, validateHGVS } from '../variant';

describe('Variant Normalization', () => {
  describe('parseHGVS', () => {
    it('parses valid protein HGVS', () => {
      const result = parseHGVS('BRCA1:p.Cys61Gly');
      expect(result).toEqual({
        gene: 'BRCA1',
        ref: 'C',
        pos: 61,
        alt: 'G',
        type: 'missense'
      });
    });

    it('parses substitution with 3-letter code', () => {
      const result = parseHGVS('TP53:p.Arg175His');
      expect(result.pos).toBe(175);
      expect(result.ref).toBe('R');
      expect(result.alt).toBe('H');
    });

    it('rejects invalid format', () => {
      expect(() => parseHGVS('invalid')).toThrow('Invalid HGVS format');
      expect(() => parseHGVS('BRCA1')).toThrow('Invalid HGVS format');
      expect(() => parseHGVS('BRCA1:123')).toThrow('Invalid HGVS format');
    });

    it('rejects nucleotide HGVS', () => {
      expect(() => parseHGVS('BRCA1:c.61C>G')).toThrow('Protein HGVS required');
    });

    it('handles stop codons', () => {
      const result = parseHGVS('CFTR:p.Arg117His');
      expect(result.alt).toBe('H');
    });
  });

  describe('normalizeVariant', () => {
    it('converts 3-letter to 1-letter code', () => {
      const result = normalizeVariant('BRCA1:p.Cys61Gly');
      expect(result.normalized).toBe('BRCA1:p.C61G');
    });

    it('validates amino acid codes', () => {
      expect(() => normalizeVariant('BRCA1:p.Xyz61Gly')).toThrow('Invalid amino acid');
    });
  });
});
```
Implementation Required: src/lib/variant.ts

### 2. Structure Resolution Tests
**File:** `src/lib/__tests__/structure.test.ts`

```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { resolveStructure, PDBResolver, AlphaFoldResolver } from '../structure';

describe('Structure Resolution', () => {
  describe('PDBResolver', () => {
    it('returns PDB when experimental structure exists', async () => {
      const resolver = new PDBResolver();
      const result = await resolver.resolve('P04637', 175);
      
      expect(result.source).toBe('PDB');
      expect(result.id).toMatch(/^\d[A-Z0-9]{3}$/);
      expect(result.resolution).toBeLessThan(4.0);
      expect(result.experimental).toBe(true);
    });

    it('returns null when no PDB coverage', async () => {
      const resolver = new PDBResolver();
      const result = await resolver.resolve('NEW_GENE', 1);
      expect(result).toBeNull();
    });

    it('handles PDB API failure gracefully', async () => {
      // Mock failure
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      
      const resolver = new PDBResolver();
      await expect(resolver.resolve('P04637', 175)).rejects.toThrow('PDB unavailable');
    });
  });

  describe('AlphaFoldResolver', () => {
    it('returns AlphaFold structure when available', async () => {
      const resolver = new AlphaFoldResolver();
      const result = await resolver.resolve('P04637');
      
      expect(result.source).toBe('AlphaFold');
      expect(result.id).toBe('AF-P04637-F1');
      expect(result.plddt).toBeDefined();
      expect(result.experimental).toBe(false);
    });
  });

  describe('resolveStructure (hierarchy)', () => {
    it('prefers PDB over AlphaFold', async () => {
      const result = await resolveStructure('P04637', 175);
      expect(result.source).toBe('PDB');
    });

    it('falls back to AlphaFold when no PDB', async () => {
      // Mock PDB to return null
      jest.spyOn(PDBResolver.prototype, 'resolve').mockResolvedValue(null);
      
      const result = await resolveStructure('P04637', 175);
      expect(result.source).toBe('AlphaFold');
    });

    it('throws when neither available', async () => {
      jest.spyOn(PDBResolver.prototype, 'resolve').mockResolvedValue(null);
      jest.spyOn(AlphaFoldResolver.prototype, 'resolve').mockRejectedValue(new Error('Not found'));
      
      await expect(resolveStructure('INVALID', 1)).rejects.toThrow('No structure found');
    });

    it('caches results', async () => {
      const spy = jest.spyOn(global, 'fetch');
      await resolveStructure('P04637', 175);
      await resolveStructure('P04637', 175); // Second call
      
      // Should only fetch once due to cache
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
```
Implementation Required: src/lib/structure.ts

### 3. Agent Orchestration Tests
**File:** `src/lib/__tests__/agents.test.ts`
```typescript
import { describe, it, expect, jest } from '@jest/globals';
import { AgentOrchestrator } from '../agents';
import { ContextAgent, MechanismAgent, CriticAgent } from '../agents/agents';

describe('Agent Orchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  it('runs full pipeline', async () => {
    const result = await orchestrator.analyze('BRCA1:p.Cys61Gly');
    
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('hypothesis');
    expect(result).toHaveProperty('validation');
    expect(result.hypothesis.confidence).toMatch(/high|moderate|low|uncertain/);
  });

  it('requires citations for claims', async () => {
    const result = await orchestrator.analyze('BRCA1:p.Cys61Gly');
    
    if (result.hypothesis.citations.length === 0) {
      expect(result.hypothesis.text).toContain('No direct literature');
    } else {
      result.hypothesis.citations.forEach(citation => {
        expect(citation.pmid).toMatch(/^\d+$/);
      });
    }
  });

  it('downgrades confidence on unsupported claims', async () => {
    // Mock CriticAgent to flag unsupported claim
    jest.spyOn(CriticAgent.prototype, 'review').mockResolvedValue({
      flags: ['UNSUPPORTED: mechanism X'],
      recommendedConfidence: 'uncertain'
    });

    const result = await orchestrator.analyze('UNKNOWN:p.Ala1Val');
    expect(result.hypothesis.confidence).toBe('uncertain');
  });

  it('handles agent timeout gracefully', async () => {
    jest.spyOn(ContextAgent.prototype, 'run').mockImplementation(() => 
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
    );

    await expect(orchestrator.analyze('BRCA1:p.Cys61Gly')).rejects.toThrow('Analysis timeout');
  });
});
```
Implementation Required: src/lib/agents/index.ts, src/lib/agents/agents.ts

### 4. Rate Limiting Tests
**File:** `src/lib/__tests__/rate-limit.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';
import { RateLimiter } from '../rate-limit';

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
```
Implementation Required: src/lib/rate-limit.ts

### 5. API Integration Tests
**File:** `src/app/api/__tests__/variant.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createServer } from '../test-server';

describe('POST /api/variant', () => {
  let server: any;

  beforeAll(() => {
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
    expect(response.body).toHaveProperty('variant', 'BRCA1:p.Cys61Gly');
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

  it('returns 404 for unknown variant', async () => {
    const response = await request(server)
      .post('/api/variant')
      .send({ hgvs: 'FAKEGENE:p.Ala1Val' });

    expect(response.status).toBe(404);
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

    // MD format would return text/markdown
    const mdResponse = await request(server)
      .post('/api/variant?format=md')
      .send({ hgvs: 'BRCA1:p.Cys61Gly' });
    expect(mdResponse.headers['content-type']).toContain('text/markdown');
  });
});
```

**File:** `src/app/api/__tests__/batch.test.ts`
```typescript
import { describe, it, expect } from '@jest/globals';
import request from 'supertest';

describe('POST /api/batch', () => {
  it('accepts up to 20 variants', async () => {
    const variants = Array(20).fill('BRCA1:p.Cys61Gly');
    const response = await request(server)
      .post('/api/batch')
      .send({ variants });

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('jobId');
  });

  it('rejects >20 variants', async () => {
    const variants = Array(21).fill('BRCA1:p.Cys61Gly');
    const response = await request(server)
      .post('/api/batch')
      .send({ variants });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Max 20 variants');
  });

  it('returns job status', async () => {
    const submit = await request(server)
      .post('/api/batch')
      .send({ variants: ['BRCA1:p.Cys61Gly'] });

    const status = await request(server)
      .get(`/api/batch/${submit.body.jobId}/status`);

    expect(status.status).toBe(200);
    expect(status.body).toHaveProperty('status', 'completed');
  });
});
```

### 6. Validation Alignment Tests
**File:** `src/validation/__tests__/alignment.test.ts`
```typescript
import { describe, it, expect } from '@jest/globals';
import { compareToExpert, calculateAlignment } from '../alignment';
import curatedSet from '../curated_set.json';

describe('Validation Set Alignment', () => {
  it('all curated variants have required fields', () => {
    curatedSet.forEach(variant => {
      expect(variant).toHaveProperty('hgvs');
      expect(variant).toHaveProperty('expertHypothesis');
      expect(variant).toHaveProperty('expertConfidence');
      expect(variant.expertConfidence).toMatch(/high|moderate|low/);
    });
  });

  it('alignment scoring works', () => {
    const expert = {
      mechanism: 'Loss of zinc coordination',
      confidence: 'high'
    };
    const agent = {
      mechanism: 'Disrupts zinc binding',
      confidence: 'moderate'
    };

    const score = calculateAlignment(expert, agent);
    expect(score.mechanismAgreement).toBe('partial');
    expect(score.confidenceCalibration).toBe('under');
  });

  it('achieves >75% agreement on curated set', async () => {
    const results = await Promise.all(
      curatedSet.map(v => compareToExpert(v.hgvs))
    );

    const good = results.filter(r => 
      r.agreement === 'full' || r.agreement === 'partial'
    );

    const percentage = (good.length / results.length) * 100;
    expect(percentage).toBeGreaterThan(75);
  });
});
```

## Running Tests
```bash
# Install dependencies
npm install

# Run all backend tests
npm run test:backend

# Run with coverage
npm run test:backend -- --coverage

# Watch mode (development)
npm run test:backend -- --watch

# Specific test file
npm run test:backend -- variant.test.ts
```

## Coverage Requirements
| Module | Lines | Functions | Branches |
|---|---|---|---|
| variant.ts | 100% | 100% | 100% |
| structure.ts | 100% | 100% | 90% |
| agents/*.ts | 90% | 90% | 80% |
| rate-limit.ts | 100% | 100% | 100% |
| API routes | 100% | 100% | 90% |

## Gate Criteria
Before proceeding to frontend:
- [ ] All tests pass (npm run test:backend exits 0)
- [ ] Coverage thresholds met
- [ ] No TypeScript errors (npm run typecheck)
- [ ] No lint errors (npm run lint)
- [ ] API documentation updated
- [ ] JOURNEY.md updated with test results

## Test Data Fixtures
**File:** `src/lib/__tests__/fixtures/variants.json`
```json
{
  "valid": [
    {"hgvs": "BRCA1:p.Cys61Gly", "expected": {"gene": "BRCA1", "pos": 61}},
    {"hgvs": "TP53:p.Arg175His", "expected": {"gene": "TP53", "pos": 175}},
    {"hgvs": "CFTR:p.Phe508del", "expected": {"gene": "CFTR", "type": "deletion"}}
  ],
  "invalid": [
    "invalid",
    "BRCA1",
    "BRCA1:c.61C>G",
    "BRCA1:p.Xyz123Gly"
  ]
}
```

**File:** `src/lib/__tests__/fixtures/structures.json`
```json
{
  "pdbResponses": {
    "P04637": {
      "structures": [
        {"pdb_id": "1TUP", "resolution": 2.2, "coverage": [94, 292]}
      ]
    }
  },
  "alphaFoldResponses": {
    "P04637": {
      "uniprot_id": "P04637",
      "model_url": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.pdb"
    }
  }
}
```

## Mocking External APIs
```typescript
// src/lib/__tests__/mocks/external-apis.ts
export const mockPDBAPI = () => {
  jest.spyOn(global, 'fetch').mockImplementation((url: string) => {
    if (url.includes('rcsb.org')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ structures: [{ pdb_id: '1TUP' }] })
      } as Response);
    }
    // ... other mocks
  });
};

export const mockOpenAI = () => {
  jest.mock('openai', () => ({
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{"hypothesis": "test"}' } }]
          })
        }
      }
    }))
  }));
};
```

## CI/CD Integration
```yaml
# .github/workflows/backend-tests.yml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      
      - name: Run backend tests
        run: npm run test:backend -- --coverage --coverageThreshold='{"global":{"branches":80,"functions":90,"lines":90,"statements":90}}'
      
      - name: Type check
        run: npm run typecheck
      
      - name: Lint
        run: npm run lint
      
      - name: Update Journey
        if: github.ref == 'refs/heads/main'
        run: |
          echo "## Test Results $(date)" >> JOURNEY.md
          echo "- Status: PASS" >> JOURNEY.md
          echo "- Commit: ${{ github.sha }}" >> JOURNEY.md
```
