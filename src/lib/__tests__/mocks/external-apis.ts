import { jest } from '@jest/globals';
import { FIXTURES } from './fixtures';
import { MOCK_PDB_SEARCH_RESPONSE, MOCK_PDB_ENTRY_RESPONSE, MOCK_ALPHAFOLD_RESPONSE, MOCK_PDB_ASSEMBLY_RESPONSE } from './data'; // Legacy, prefer FIXTURES

export const mockFetch = () => {
  const mockImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    console.log(`[MockFetch] Request: ${url}`);

    // PDB API
    if (url.includes('search.rcsb.org')) {
      if (init?.body && typeof init.body === 'string' && (init.body.includes('NEW_GENE') || init.body.includes('FAKEGENE'))) {
           return { ok: true, json: async () => ({ result_set: [] }) } as Response;
      }
      return { ok: true, json: async () => MOCK_PDB_SEARCH_RESPONSE } as Response;
    }
    if (url.includes('data.rcsb.org')) {
      if (url.includes('/assembly/')) {
         return { ok: true, json: async () => MOCK_PDB_ASSEMBLY_RESPONSE } as Response;
      }
      return { ok: true, json: async () => MOCK_PDB_ENTRY_RESPONSE } as Response;
    }
    // Health check
    if (url.includes('www.rcsb.org/robots.txt')) {
        return { ok: true } as Response;
    }

    // AlphaFold API
    if (url.includes('alphafold.ebi.ac.uk')) {
      if (url.includes('UNKNOWN')) return { ok: true, json: async () => [] } as Response;
      return {
        ok: true,
        json: async () => MOCK_ALPHAFOLD_RESPONSE
      } as Response;
    }

    // UniProt API
    if (url.includes('uniprot.org')) {
      if (url.includes('FAKEGENE') || url.includes('INVALID')) {
           return { ok: false, status: 404, statusText: "Not Found" } as Response;
      }
      // Handle both search and direct accession lookups
      return {
        ok: true,
        json: async () => {
          // Direct accession lookup like /uniprotkb/P04637.json
          if (url.includes('/uniprotkb/P')) {
            return FIXTURES.UNIPROT;
          }
          // Search endpoint returns results array
          return { results: [FIXTURES.UNIPROT] };
        }
      } as Response;
    }

    // PubMed API
    if (url.includes('esearch.fcgi')) {
      return {
          ok: true,
          json: async () => FIXTURES.PUBMED.SEARCH
      } as Response;
    }
    if (url.includes('esummary.fcgi')) {
        return {
            ok: true,
            json: async () => FIXTURES.PUBMED.SUMMARY
        } as Response;
    }

    // Default error for unmocked calls
    return Promise.reject(new Error(`Unknown URL in mockFetch: ${url}`));
  };

  return jest.spyOn(global, 'fetch').mockImplementation(mockImpl as any);
};

import { openai } from '../../agents/agents';

// ...

export const mockOpenAI = () => {
    // Spy on the existing instance method
    const spy = jest.spyOn(openai.chat.completions, 'create');
    
    spy.mockImplementation(async (body: any) => {
        const fullPrompt = JSON.stringify(body);
        
        // Determine which agent is calling based on prompt content
        let responseData: any;
        
        // CriticAgent - reviewing hypothesis
        if (fullPrompt.includes('Review this hypothesis') || fullPrompt.includes('citations_validated')) {
            responseData = FIXTURES.LLM.CRITIQUE;
        }
        // ContextAgent - gathering biological context
        else if (fullPrompt.includes('Collect biological context') || fullPrompt.includes('gene_function')) {
            responseData = FIXTURES.LLM.CONTEXT;
        }
        // MechanismAgent or default - check for known variants
        else {
            responseData = FIXTURES.LLM.HYPOTHESIS;
            
            // Dynamic alignment for known variants
            for (const [hgvs, fixture] of Object.entries(FIXTURES.LLM.ALIGNMENT_CASES)) {
                if (fullPrompt.includes(hgvs)) {
                    responseData = fixture as any;
                    break;
                }
            }
        }

        return {
           choices: [{ message: { content: JSON.stringify(responseData) } }],
           usage: { total_tokens: 100 }
        } as any;
    }) as any;

    return spy;
};

// Mock orchestrator for integration tests
import { AgentOrchestrator } from '../../agents';

export const MOCK_ORCHESTRATOR_RESULT = {
    context: {
        gene_function: "BRCA1 is involved in DNA repair through homologous recombination.",
        domain_context: "Mutation located in RING domain.",
        known_annotations: ["Tumor suppressor"],
        clinvar_summary: "Pathogenic",
        confidence: "high"
    },
    hypothesis: {
        text: "The Cys61Gly mutation disrupts zinc coordination in the RING domain.",
        confidence: "high",
        citations: [{ pmid: "12345678", title: "BRCA1 structure" }],
        structural_basis: ["Zinc-binding disrupted"]
    },
    validation: {
        flags: [],
        final_confidence: "high"
    }
};

export const mockOrchestrator = () => {
    const spy = jest.spyOn(AgentOrchestrator.prototype, 'analyze');
    spy.mockImplementation(async (hgvs: string) => {
        // Return 404-like error for unknown genes
        if (hgvs.includes('FAKEGENE')) {
            throw new Error('UniProt fetch failed: Gene not found');
        }
        return MOCK_ORCHESTRATOR_RESULT;
    });
    return spy;
};
