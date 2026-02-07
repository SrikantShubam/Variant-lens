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

    // EBI SIFTS API
    if (url.includes('pdbe/api/mappings/')) {
       // Extract PDB ID from URL (last segment)
       const pdbIdMatch = url.match(/\/mappings\/([a-zA-Z0-9]+)$/);
       const pdbId = pdbIdMatch ? pdbIdMatch[1].toLowerCase() : '1tup';
       
       return {
           ok: true,
           json: async () => ({
               [pdbId]: {
                   UniProt: {
                       "P04637": {
                           mappings: [
                               {
                                   entity_id: 1,
                                   chain_id: "A",
                                   unp_start: 1,
                                   unp_end: 393,
                                   start: { residue_number: 1 },
                                   end: { residue_number: 393 }
                               }
                           ]
                       }
                   }
               }
           })
       } as Response;
    }

    // Default error for unmocked calls
    return Promise.reject(new Error(`Unknown URL in mockFetch: ${url}`));
  };

  return jest.spyOn(global, 'fetch').mockImplementation(mockImpl as any);
};
