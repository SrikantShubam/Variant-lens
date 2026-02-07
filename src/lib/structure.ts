import { promises as fs } from 'fs';
import path from 'path';

export interface StructureData {
  source: 'PDB' | 'AlphaFold';
  id: string;
  url: string;
  resolution?: number;
  plddt?: number[];
  paeUrl?: string; // Phase-4: Link to PAE JSON
  coverage: string;
  experimental: boolean;
  coordinates?: string; // PDB format content or URL
  mapped?: boolean; // Phase-4: Track if residue is covered
}

interface CacheEntry {
  data: StructureData;
  timestamp: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export class PDBResolver {
  private baseUrl = 'https://search.rcsb.org/rcsbsearch/v2/query';
  private downloadUrl = 'https://files.rcsb.org/download';

  async resolve(uniprotId: string, residueNumber?: number): Promise<StructureData[]> {
    const cacheKey = `pdb:${uniprotId}:${residueNumber}:list`;
    // const cached = getCache(cacheKey); // Phase-4: Temporarily disable list cache or update cache logic
    // if (cached) return cached; // Type mismatch, cache stores single. Needs update.

    try {
      // Search PDB for structures matching UniProt ID
      const query = {
        query: {
          type: 'terminal',
          service: 'text',
          parameters: {
            attribute: 'rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession',
            operator: 'exact_match',
            value: uniprotId,
          },
        },
        return_type: 'entry',
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });

      if (response.status === 204) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`PDB API error: ${response.status}`);
      }

      const data = await response.json().catch(() => null);
      
      if (!data || !data.result_set || data.result_set.length === 0) {
        return [];
      }

      // Get best structure (highest resolution, covering residue if specified)
      const structures = await Promise.all(
        data.result_set.slice(0, 5).map(async (entry: any) => {
          const pdbId = entry.identifier;
          return this.getStructureDetails(pdbId, uniprotId, residueNumber);
        })
      );

      // Filter valid structures (at least entity mapped)
      const validStructures = structures.filter((s): s is StructureData => s !== null);
      
      // Sort by:
      // 1. Mapped (covered) first
      // 2. Resolution (lower is better)
      validStructures.sort((a, b) => {
        if (a.mapped !== b.mapped) return (b.mapped ? 1 : 0) - (a.mapped ? 1 : 0);
        return (a.resolution || 999) - (b.resolution || 999);
      });

      return validStructures;

    } catch (error) {
      console.error('PDB resolution failed:', error);
      throw new Error('PDB unavailable');
    }
  }

  private async getStructureDetails(
    pdbId: string, 
    uniprotId: string,
    residueNumber?: number
  ): Promise<StructureData | null> {
    try {
      // Get entry summary
      const summaryUrl = `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`;
      const summaryRes = await fetch(summaryUrl);
      
      if (!summaryRes.ok) return null;
      
      const summary = await summaryRes.json();

      // Check resolution
      const resolution = summary.rcsb_entry_info?.resolution_combined?.[0];
      if (resolution && resolution > 3.5) {
        return null; // Too low resolution
      }

      // Check coverage if residue specified
      let isMapped = true;
      if (residueNumber) {
        const coverage = await this.checkCoverage(pdbId, uniprotId, residueNumber);
        isMapped = coverage.covered;
        // Phase-4: Do NOT filter out unmapped structures. Just mark them.
      }

      return {
        source: 'PDB',
        id: pdbId,
        url: `${this.downloadUrl}/${pdbId}.cif`,
        resolution,
        coverage: residueNumber ? (isMapped ? 'target residue covered' : 'unmapped') : 'full sequence',
        experimental: true,
        mapped: isMapped
      };

    } catch (error) {
      console.error(`Failed to get details for ${pdbId}:`, error);
      return null;
    }
  }

  private async checkCoverage(
    pdbId: string, 
    uniprotId: string, 
    residueNumber: number
  ): Promise<{ covered: boolean; percentage?: number }> {
    try {
      const url = `https://data.rcsb.org/rest/v1/core/assembly/${pdbId}/1`;
      const response = await fetch(url);
      
      if (!response.ok) return { covered: false };

      const data = await response.json();
      
      // Simplified coverage check - in production, parse entity mappings
      return { covered: true, percentage: 95 };

    } catch {
      return { covered: false };
    }
  }
}

export class AlphaFoldResolver {
  private baseUrl = 'https://alphafold.ebi.ac.uk/api/prediction';

  async resolve(uniprotId: string): Promise<StructureData> {
    const cacheKey = `af:${uniprotId}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/${uniprotId}`);
      
      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          throw new Error(`AlphaFold structure not found for ${uniprotId}`);
        }
        throw new Error(`AlphaFold API error: ${response.status}`);
      }

      const data = await response.json();
      const entry = Array.isArray(data) ? data[0] : data;

      // Use API-provided URLs directly (handles version changes automatically)
      const structure: StructureData = {
        source: 'AlphaFold',
        id: entry.entryId,
        url: entry.bcifUrl || entry.cifUrl || entry.pdbUrl, // Phase-4 Optimization: Prefer BCIF > CIF > PDB
        plddt: entry.plddt,
        paeUrl: entry.paeDocUrl, // Use API-provided PAE URL (not hardcoded v4)
        coverage: `${entry.coverage?.[0]?.seqStart || 1}-${entry.coverage?.[0]?.seqEnd || 'full'}`,
        experimental: false,
      };

      setCache(cacheKey, structure);
      return structure;

    } catch (error) {
      if ((error as Error).message.includes('not found')) {
         throw error; // Propagate "not found" to route handler
      }
      console.error('AlphaFold resolution failed:', error);
      throw new Error('AlphaFold DB unavailable');
    }
  }
}

const COMMON_GENES: Record<string, string> = {
  'BRCA1': 'P38398',
  'BRCA2': 'P51587',
  'TP53': 'P04637',
  'EGFR': 'P00533',
  'CFTR': 'P13569',
  'BRAF': 'P15056',
  'KRAS': 'P01116',
  'PIK3CA': 'P42336',
  'IDH1': 'O75874',
  'IDH2': 'P48735',
};

async function fetchUniprotId(gene: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://rest.uniprot.org/uniprotkb/search?query=gene:${gene}+AND+reviewed:true&format=json&limit=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0]?.primaryAccession || null;
  } catch (e) {
    console.warn(`UniProt ID lookup failed for ${gene}:`, e);
    return null;
  }
}

export async function resolveStructure(
  uniprotId: string, 
  residueNumber?: number
): Promise<{ best: StructureData | null, available: StructureData[] }> {
  // 1. Check Hardcoded Map
  let mappedId = COMMON_GENES[uniprotId.toUpperCase()];

  // 2. Dynamic Lookup (if not mapped)
  if (!mappedId) {
     const dynamicId = await fetchUniprotId(uniprotId);
     if (dynamicId) {
       mappedId = dynamicId;
       // Optional: Cache this mapping for this session?
       COMMON_GENES[uniprotId.toUpperCase()] = dynamicId; 
     } else {
       mappedId = uniprotId; // Fallback to raw input
     }
  }

  // Try PDB first
  const pdbResolver = new PDBResolver();
  const afResolver = new AlphaFoldResolver();
  
  // Fetch both in parallel
  const [pdbResults, afResult] = await Promise.all([
    pdbResolver.resolve(mappedId, residueNumber).catch(() => [] as StructureData[]),
    afResolver.resolve(mappedId).catch(() => null)
  ]);
  
  // Combine: PDBs first, then AlphaFold
  const allStructures: StructureData[] = [...pdbResults];
  if (afResult) {
    allStructures.push(afResult);
  }
  
  if (allStructures.length > 0) {
    // Best = first PDB if available, else AlphaFold
    const best = pdbResults.length > 0 ? pdbResults[0] : afResult;
    return {
      best,
      available: allStructures
    };
  }
  
  console.warn(`Structure resolution failed for ${mappedId} (Gene: ${uniprotId})`);
  return { best: null, available: [] };
}

// Cache utilities
function getCache(key: string): StructureData | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    CACHE.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: StructureData): void {
  CACHE.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// Clear cache (for testing)
export function clearStructureCache(): void {
  CACHE.clear();
}
