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

/** Structured coverage result with explicit reason codes */
export interface CoverageResult {
  covered: boolean;
  reason: 'resolved' | 'gap' | 'unmapped' | 'partial';
  percentage?: number;
}

// PDBe observed residues cache (5 min TTL to avoid rate limiting)
const PDBE_CACHE_TTL = 5 * 60 * 1000;
const pdbeCache = new Map<string, { data: any; timestamp: number }>();

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
        return_type: 'polymer_entity', // Changed from 'entry' to get specific chain
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
          // Identifier is now like "1TUP_3" (PDB_Entity)
          const [pdbId, entityId] = entry.identifier.split('_');
          return this.getStructureDetails(pdbId, entityId, uniprotId, residueNumber);
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
    entityId: string, 
    uniprotId: string,
    residueNumber?: number
  ): Promise<StructureData | null> {
    try {
      // 1. Get Entry Summary (for resolution)
      const summaryUrl = `https://data.rcsb.org/rest/v1/core/entry/${pdbId}`;
      const summaryRes = await fetch(summaryUrl);
      
      if (!summaryRes.ok) return null;
      
      const summary = await summaryRes.json();
      const resolution = summary.rcsb_entry_info?.resolution_combined?.[0];
      
      // Filter poor resolution
      if (resolution && resolution > 3.5) {
        return null;
      }

      // 2. Check Coverage (residue-level, gap-safe)
      let isMapped = true;
      let coverageNote = 'full sequence';
      let coverageReason: CoverageResult['reason'] = 'resolved';

      if (residueNumber) {
        const coverage = await this.checkCoverage(pdbId, entityId, residueNumber);
        isMapped = coverage.covered;
        coverageReason = coverage.reason;
        coverageNote = isMapped 
          ? `target residue covered (${coverage.reason})` 
          : `unmapped (${coverage.reason})`;
      }

      return {
        source: 'PDB',
        id: pdbId,
        url: `${this.downloadUrl}/${pdbId}.cif`,
        resolution,
        coverage: coverageNote,
        experimental: true,
        mapped: isMapped
      };

    } catch (error) {
      console.error(`Failed to get details for ${pdbId}:`, error);
      return null;
    }
  }

  /**
   * Residue-level, gap-safe coverage check.
   * 
   * 1. Maps UniProt residue → PDB residue via SIFTS aligned regions
   * 2. Queries PDBe observed_residues_ratio to check if residue is resolved
   * 3. Falls back to range-based with reason 'partial' if PDBe unavailable
   *
   * @param residueNumber - UniProt residue index (NOT PDB author numbering)
   */
  private async checkCoverage(
    pdbId: string, 
    entityId: string,
    residueNumber: number
  ): Promise<CoverageResult> {
    try {
      // Step 1: Get SIFTS alignment to map UniProt → PDB residue
      const url = `https://data.rcsb.org/rest/v1/core/polymer_entity/${pdbId}/${entityId}`;
      const response = await fetch(url);
      
      if (!response.ok) return { covered: false, reason: 'unmapped' };

      const data = await response.json();
      const alignments = data.rcsb_polymer_entity_align || [];
      
      // Look for SIFTS mapping to UniProt
      const siftsMapping = alignments.find((a: any) => 
        a.provenance_source === 'SIFTS' && 
        a.reference_database_name === 'UniProt'
      );

      if (!siftsMapping || !siftsMapping.aligned_regions) {
        return { covered: false, reason: 'unmapped' };
      }

      // Step 2: Map UniProt residue → PDB residue number
      let pdbResidueNumber: number | null = null;
      let chainId: string | null = null;

      for (const region of siftsMapping.aligned_regions) {
        const uniprotStart = region.ref_beg_seq_id;  // UniProt start
        const pdbStart = region.query_beg_seq_id || region.ref_beg_seq_id; // PDB entity start
        const length = region.length;
        const uniprotEnd = uniprotStart + length - 1;

        if (residueNumber >= uniprotStart && residueNumber <= uniprotEnd) {
          // Calculate PDB residue from offset
          const offset = residueNumber - uniprotStart;
          pdbResidueNumber = pdbStart + offset;
          break;
        }
      }

      if (pdbResidueNumber === null) {
        // Residue not in any aligned region
        return { covered: false, reason: 'unmapped' };
      }

      // Get chain ID from entity instances
      const instances = data.rcsb_polymer_entity_instance_container_identifiers;
      if (instances && instances.length > 0) {
        chainId = instances[0].auth_asym_id || instances[0].asym_id || null;
      }

      // Step 3: Check if residue is actually observed (not a gap)
      const observedResult = await this.checkResidueObserved({
        pdbId,
        entityId,
        pdbResidueNumber,
        chainId,
      });

      return observedResult;

    } catch {
      // On any error, fall back to honest 'partial'
      return { covered: false, reason: 'partial' };
    }
  }

  /**
   * Check if a specific PDB residue is observed (has electron density).
   * Uses PDBe observed_residues_ratio API.
   * Falls back to 'partial' (range-implied) if API unavailable.
   */
  private async checkResidueObserved(mapping: {
    pdbId: string;
    entityId: string;
    pdbResidueNumber: number;
    chainId: string | null;
  }): Promise<CoverageResult> {
    const { pdbId, entityId, pdbResidueNumber, chainId } = mapping;

    try {
      // Check PDBe cache first
      const cacheKey = `pdbe:${pdbId}`;
      let observedData = pdbeCache.get(cacheKey);

      if (!observedData || (Date.now() - observedData.timestamp > PDBE_CACHE_TTL)) {
        // Fetch from PDBe
        const pdbeUrl = `https://www.ebi.ac.uk/pdbe/api/pdb/entry/observed_residues_ratio/${pdbId.toLowerCase()}`;
        const response = await fetch(pdbeUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000), // 5s timeout
        });

        if (!response.ok) {
          // PDBe unavailable - fall back to range-based with 'partial'
          console.warn(`[Structure] PDBe observed residues API returned ${response.status} for ${pdbId}`);
          return { covered: true, reason: 'partial' }; // Range says yes, but can't confirm
        }

        const rawData = await response.json();
        pdbeCache.set(cacheKey, { data: rawData, timestamp: Date.now() });
        observedData = { data: rawData, timestamp: Date.now() };
      }

      // Parse PDBe response: keyed by lowercase PDB ID
      const pdbEntry = observedData.data[pdbId.toLowerCase()];
      if (!pdbEntry) {
        return { covered: true, reason: 'partial' };
      }

      // PDBe response shape varies by entry:
      // - direct array of chain rows
      // - object with `chains`
      // - object with `molecules` where each molecule has `chains`
      const normalizeChainRows = (entry: any): any[] => {
        if (!entry) return [];
        if (Array.isArray(entry)) return entry;
        if (Array.isArray(entry.chains)) return entry.chains;
        if (Array.isArray(entry.molecules)) {
          const rows: any[] = [];
          for (const mol of entry.molecules) {
            if (Array.isArray(mol?.chains)) {
              for (const chain of mol.chains) {
                rows.push({
                  ...chain,
                  entity_id: chain?.entity_id ?? mol?.entity_id,
                });
              }
            } else if (mol && typeof mol === 'object') {
              rows.push(mol);
            }
          }
          return rows;
        }
        if (typeof entry === 'object') return [entry];
        return [];
      };

      const chainRows = normalizeChainRows(pdbEntry);
      if (chainRows.length === 0) {
        return { covered: true, reason: 'partial' };
      }

      // Look through chains/entities
      for (const chain of chainRows) {
        // Match by chain or entity
        const chainMatch = chainId
          ? (chain.chain_id === chainId || chain.auth_asym_id === chainId || chain.asym_id === chainId)
          : true;
        const entityMatch = chain.entity_id?.toString() === entityId;

        if (chainMatch || entityMatch) {
          // Check if our specific residue is in the observed ranges
          const residueCount = Number(chain.residue_count ?? chain.total_residue_count ?? 0);
          const observedCount = Number(chain.observed_count ?? chain.observed_residue_count ?? 0);
          if (residueCount > 0 || observedCount > 0) {
            // If residue ranges are present, use exact gap check.
            const ranges = chain.observed_residue_ranges || chain.observed_ranges || chain.residue_ranges || [];
            if (Array.isArray(ranges) && ranges.length > 0) {
              for (const range of ranges) {
                const start = Number(range?.start?.residue_number ?? range?.start ?? range?.[0]);
                const end = Number(range?.end?.residue_number ?? range?.end ?? range?.[1]);
                if (Number.isFinite(start) && Number.isFinite(end) && pdbResidueNumber >= start && pdbResidueNumber <= end) {
                  return { covered: true, reason: 'resolved' };
                }
              }
              // Residue not in any observed range = gap.
              return { covered: false, reason: 'gap' };
            }

            // No residue-level ranges: use observed ratio heuristic.
            const ratio = Number(chain.observed_ratio ?? (residueCount > 0 ? observedCount / residueCount : 0));
            if (ratio >= 0.95) return { covered: true, reason: 'resolved' };
            return { covered: true, reason: 'partial' };
          }
        }
      }

      // No matching chain found - range says covered but can't confirm
      return { covered: true, reason: 'partial' };

    } catch (error) {
      // PDBe API error (rate limit, timeout, etc.) -> graceful fallback
      console.warn(`[Structure] PDBe observed residues check failed for ${pdbId}:`, error);
      return { covered: true, reason: 'partial' }; // Honest: range says yes, can't verify
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
        // Prefer CIF for compatibility with the bundled PDBe viewer.
        url: entry.cifUrl || entry.pdbUrl || entry.bcifUrl,
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

