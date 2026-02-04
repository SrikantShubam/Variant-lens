/**
 * SIFTS API Client
 * 
 * Phase-2 Priority 3: Residue Mapping (UniProt <-> PDB)
 * 
 * Maps UniProt residue numbers to PDB residue numbers using SIFTS.
 * This ensures structure visualization aligns with sequence data.
 * 
 * API: https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/{uniprot_id}
 */

export interface SiftsResult {
  mapped: boolean;
  pdbId: string;
  chain: string;
  pdbResidue: string; // String because PDB can have insertion codes (e.g., 60A)
  source: string;
  note?: string;
}

// Cache to avoid repeated API calls
const siftsCache = new Map<string, any>(); // Cache full API response
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get SIFTS mapping for a specific PDB Structure
 */
export async function getSiftsMapping(
  uniprotId: string,
  residueNumber: number,
  pdbId: string
): Promise<SiftsResult | null> {
  const cacheKey = `sifts:${uniprotId}`;
  
  // Clean PDB ID (remove structure source prefix if present)
  // e.g. "PDB 3E63" -> "3e63"
  const cleanPdbId = pdbId.replace(/^PDB\s+/i, '').toLowerCase();

  // 1. Fetch or Get Cached SIFTS Data (by PDB ID)
  // Use PDB ID endpoint as UniProt endpoint is unreliable/deprecated
  const pdbCacheKey = `sifts:pdb:${cleanPdbId}`;
  let data = siftsCache.get(pdbCacheKey);
  
  if (!data) {
    try {
      console.log(`[SIFTS] Fetching mappings for PDB ${cleanPdbId}...`);
      const response = await fetch(`https://www.ebi.ac.uk/pdbe/api/mappings/${cleanPdbId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`SIFTS API error: ${response.status}`);
      }
      data = await response.json();
      siftsCache.set(pdbCacheKey, data);
    } catch (error) {
      console.error('[SIFTS] API fetch failed:', error);
      return null;
    }
  }

  // 2. Parse Mapping
  // Structure: data[cleanPdbId].UniProt[uniprotId].mappings -> array
  // Keys are usually case-sensitive specific to the API response (PDB lower, UniProt upper/as-is)
  
  const pdbEntry = data[cleanPdbId] || data[cleanPdbId.toUpperCase()];
  if (!pdbEntry || !pdbEntry.UniProt) {
    return null; 
  }

  // Find the specific UniProt entry (handle case sensitivity)
  const unpEntry = pdbEntry.UniProt[uniprotId] || pdbEntry.UniProt[uniprotId.toUpperCase()];
  
  if (!unpEntry || !unpEntry.mappings || !Array.isArray(unpEntry.mappings)) {
    return null;
  }
  
  const mappings = unpEntry.mappings;

  // 3. Find the segment covering our residue
  // SIFTS returns segments like: { unp_start: 696, unp_end: 1022, start: { residue_number: 696 }, ... }
  
  for (const map of mappings) {
    const unpStart = map.unp_start;
    const unpEnd = map.unp_end;
    
    if (residueNumber >= unpStart && residueNumber <= unpEnd) {
      // FOUND MAPPING
      const offset = residueNumber - unpStart;
      const pdbStart = map.start.residue_number;
      const mappedPdbResidue = pdbStart + offset;
      
      return {
        mapped: true,
        pdbId: cleanPdbId.toUpperCase(),
        chain: map.chain_id, // e.g. "A"
        pdbResidue: String(mappedPdbResidue),
        source: 'PDBe-KB',
      };
    }
  }

  // 4. If loop finishes, residue is NOT in mapped segments (e.g. disordered loop, truncated struct)
  return {
    mapped: false,
    pdbId: cleanPdbId.toUpperCase(),
    chain: '?',
    pdbResidue: '?',
    source: 'PDBe-KB',
    note: 'Residue not resolved in this structure (likely disordered or truncated)'
  };
}
