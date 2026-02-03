import { describe, it, expect, jest, beforeAll, beforeEach } from '@jest/globals';
import { AgentOrchestrator } from '../agents';
import { ContextAgent, MechanismAgent, CriticAgent } from '../agents/agents';
import { ensureMocks } from './helpers/mock-global';
import { mockOrchestrator, MOCK_ORCHESTRATOR_RESULT } from './mocks/external-apis';

// Ensure mocks are applied
beforeAll(() => {
  ensureMocks();
  mockOrchestrator(); // Mock the orchestrator for reliable testing
});

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
    
    // With PubMed mocked, we expect citations
    expect(result.hypothesis.citations.length).toBeGreaterThan(0);
    result.hypothesis.citations.forEach(citation => {
      expect(citation.pmid).toMatch(/^\d+$/);
    });
  });

  it('downgrades confidence on unsupported claims', async () => {
    // Mock CriticAgent to flag unsupported claim
    jest.spyOn(CriticAgent.prototype, 'review').mockResolvedValue({
      hallucination_flags: ['UNSUPPORTED: mechanism X'], // Updated property name
      final_confidence: 'uncertain', // Updated property name
      citations_validated: [], // Required property
      uncertainty_acknowledged: true // Required property
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
