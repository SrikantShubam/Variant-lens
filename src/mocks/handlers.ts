import { http, HttpResponse } from 'msw';
import { pdbFixtures } from './fixtures/pdb';
import { alphaFoldFixtures } from './fixtures/alphafold';
import { uniprotFixtures } from './fixtures/uniprot';
import { openRouterFixtures } from './fixtures/openrouter';

const API_BASES = {
  pdb: 'https://search.rcsb.org/rcsbsearch/v2',
  pdbData: 'https://data.rcsb.org/rest/v1',
  alphaFold: 'https://alphafold.ebi.ac.uk/api',
  uniprot: 'https://rest.uniprot.org',
  openRouter: 'https://openrouter.ai/api/v1',
  pubmed: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
};

export const handlers = [
  // PDB Search
  http.post(`${API_BASES.pdb}/query`, async ({ request }) => {
    const body = await request.json() as any;
    const uniprotId = body?.query?.parameters?.value;
    
    if (pdbFixtures[uniprotId]) {
      return HttpResponse.json(pdbFixtures[uniprotId].search);
    }
    
    return HttpResponse.json({ result_set: [] });
  }),

  // PDB Data (structure details)
  http.get(`${API_BASES.pdbData}/core/entry/:pdbId`, ({ params }) => {
    const { pdbId } = params;
    
    for (const fixtures of Object.values(pdbFixtures)) {
      const entry = fixtures.entries[pdbId as string];
      if (entry) return HttpResponse.json(entry);
    }
    
    return new HttpResponse(null, { status: 404 });
  }),

  // AlphaFold
  http.get(`${API_BASES.alphaFold}/prediction/:uniprotId`, ({ params }) => {
    const { uniprotId } = params;
    const fixture = alphaFoldFixtures[uniprotId as string];
    
    if (fixture) {
      return HttpResponse.json([fixture]);
    }
    
    return new HttpResponse(null, { status: 404 });
  }),

  // UniProt
  http.get(`${API_BASES.uniprot}/uniprotkb/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    // Regex to extract gene name from query like "gene:BRCA1 AND reviewed:true"
    const geneMatch = query?.match(/gene:(\w+)/);
    const gene = geneMatch ? geneMatch[1] : null;
    
    if (gene && uniprotFixtures[gene]) {
      return HttpResponse.json({
        results: [uniprotFixtures[gene]],
      });
    }
    
    return HttpResponse.json({ results: [] });
  }),

  http.get(`${API_BASES.uniprot}/uniprotkb/:uniprotId`, ({ params }) => {
    const { uniprotId } = params;
    
    for (const entry of Object.values(uniprotFixtures)) {
      if (entry.primaryAccession === uniprotId) {
        return HttpResponse.json(entry);
      }
    }
    
    return new HttpResponse(null, { status: 404 });
  }),

  // PubMed / ClinVar (eutils)
  http.get(`${API_BASES.pubmed}/esearch.fcgi`, ({ request }) => {
    const url = new URL(request.url);
    const db = url.searchParams.get('db');
    const term = url.searchParams.get('term');
    
    if (db === 'pubmed') {
      return HttpResponse.json({
        esearchresult: {
          count: '2',
          idlist: ['19117993', '21952604'],
        },
      });
    }
    
    if (db === 'clinvar') {
      return HttpResponse.json({
        esearchresult: {
          count: term?.includes('BRCA1') ? '1' : '0',
          idlist: term?.includes('BRCA1') ? ['12345'] : [],
        },
      });
    }
    
    return HttpResponse.json({ esearchresult: { count: '0', idlist: [] } });
  }),

  http.get(`${API_BASES.pubmed}/esummary.fcgi`, ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get('id')?.split(',') || [];
    
    const result: Record<string, any> = { result: {} };
    
    for (const id of ids) {
      result.result[id] = {
        uid: id,
        title: `Mock Paper Title for ${id}`,
        source: 'Mock Journal',
        pubdate: '2024',
      };
    }
    
    return HttpResponse.json(result);
  }),

  // OpenRouter (fallback chain)
  http.post(`${API_BASES.openRouter}/chat/completions`, async ({ request }) => {
    const body = await request.json() as any;
    const model = body?.model;
    
    // Simulate model fallbacks
    if (model?.includes('gemini') && openRouterFixtures.errors.geminiRateLimit) {
      return new HttpResponse(
        JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
        { status: 429 }
      );
    }
    
    const response = (openRouterFixtures.responses as any)[model] || 
                     openRouterFixtures.responses.default;
    
    return HttpResponse.json(response);
  }),

  // Circuit breaker test endpoint
  http.get(`${API_BASES.openRouter}/auth/key`, () => {
    return HttpResponse.json({ 
      data: { 
        usage: 0.5, 
        limit: 1.0,
        rate_limit: { requests: 10, interval: '10s' }
      } 
    });
  }),
];

// Error scenarios for testing
export const errorHandlers = {
  pdbDown: http.post(`${API_BASES.pdb}/query`, () => {
    return new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' });
  }),
  
  alphaFoldTimeout: http.get(`${API_BASES.alphaFold}/prediction/:uniprotId`, () => {
    return new HttpResponse(null, { status: 408, statusText: 'Request Timeout' });
  }),
  
  openRouterRateLimit: http.post(`${API_BASES.openRouter}/chat/completions`, () => {
    return new HttpResponse(
      JSON.stringify({ 
        error: { 
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit'
        } 
      }),
      { 
        status: 429,
        headers: { 'Retry-After': '60' }
      }
    );
  }),
  
  uniprotMalformed: http.get(`${API_BASES.uniprot}/uniprotkb/search`, () => {
    return HttpResponse.text('not valid json');
  }),
};
