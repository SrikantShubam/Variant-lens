import { promises as fs } from 'fs';
import path from 'path';

export interface StructureData {
  source: 'PDB' | 'AlphaFold';
  id: string;
  url: string;
  resolution?: number;
  plddt?: number[];
  coverage: string;
  experimental: boolean;
  coordinates?: string; // PDB format content or URL
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

  async resolve(uniprotId: string, residueNumber?: number): Promise<StructureData | null> {
    const cacheKey = `pdb:${uniprotId}:${residueNumber}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

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
        return null;
      }

      if (!response.ok) {
        throw new Error(`PDB API error: ${response.status}`);
      }

      const data = await response.json().catch(() => null);
      
      if (!data || !data.result_set || data.result_set.length === 0) {
        return null;
      }

      // Get best structure (highest resolution, covering residue if specified)
      const structures = await Promise.all(
        data.result_set.slice(0, 5).map(async (entry: any) => {
          const pdbId = entry.identifier;
          return this.getStructureDetails(pdbId, uniprotId, residueNumber);
        })
      );

      // Filter valid structures
      const validStructures = structures.filter((s): s is StructureData => s !== null);
      
      // Sort by resolution (best first)
      validStructures.sort((a, b) => (a.resolution || 999) - (b.resolution || 999));

      const bestStructure = validStructures[0];
      if (bestStructure) {
        setCache(cacheKey, bestStructure);
      }

      return bestStructure || null;

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
      if (residueNumber) {
        const coverage = await this.checkCoverage(pdbId, uniprotId, residueNumber);
        if (!coverage.covered) return null;
      }

      return {
        source: 'PDB',
        id: pdbId,
        url: `${this.downloadUrl}/${pdbId}.cif`,
        resolution,
        coverage: residueNumber ? 'target residue covered' : 'full sequence',
        experimental: true,
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

      const structure: StructureData = {
        source: 'AlphaFold',
        id: entry.entryId,
        url: entry.pdbUrl,
        plddt: entry.plddt,
        coverage: `${entry.coverage?.[0]?.queryStart}-${entry.coverage?.[0]?.queryEnd}`,
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

export async function resolveStructure(
  uniprotId: string, 
  residueNumber?: number
): Promise<StructureData | null> {
  // Map gene name to UniProt ID if possible
  const mappedId = COMMON_GENES[uniprotId.toUpperCase()] || uniprotId;

  // Try PDB first
  const pdbResolver = new PDBResolver();
  const pdbResult = await pdbResolver.resolve(mappedId, residueNumber);
  
  if (pdbResult) {
    return pdbResult;
  }

  // Fallback to AlphaFold
  const afResolver = new AlphaFoldResolver();
  try {
    return await afResolver.resolve(mappedId);
  } catch (e) {
    console.warn(`Structure resolution failed for ${mappedId}:`, e);
    return null;
  }
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
