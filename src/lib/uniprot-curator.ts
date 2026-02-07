/**
 * UNIPROT CURATOR
 * 
 * Curated extraction of protein information from UniProt.
 * Replaces raw JSON dump with structured, validated data.
 * 
 * Key functions:
 * - Domain extraction (only explicitly annotated)
 * - Functional site detection
 * - Variant position validation
 * - Unknown generation
 */

import { 
  CuratedProteinInfo, 
  EvidenceCoverage, 
  ExplicitUnknowns,
  UNKNOWN_MESSAGES,
  VariantValidationError 
} from './types/honest-response';

// ==========================================
// CONSTANTS
// ==========================================

const UNIPROT_API = 'https://rest.uniprot.org/uniprotkb';

// Feature types we extract (explicit UniProt annotations only)
const DOMAIN_FEATURES = ['Domain', 'Region', 'Repeat', 'Zinc finger', 'Motif'];
const FUNCTIONAL_SITE_FEATURES = ['Active site', 'Binding site', 'Metal binding', 'Disulfide bond'];

// Cache to avoid repeated API calls
const CACHE = new Map<string, any>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ==========================================
// GENE TO UNIPROT MAPPING
// ==========================================

const COMMON_GENES: Record<string, string> = {
  'JAK2': 'O60674',
  'BRAF': 'P15056',
  'TP53': 'P04637',
  'BRCA1': 'P38398',
  'BRCA2': 'P51587',
  'EGFR': 'P00533',
  'KRAS': 'P01116',
  'PIK3CA': 'P42336',
  'IDH1': 'O75874',
  'IDH2': 'P48735',
  'CFTR': 'P13569',
  'PTEN': 'P60484',
  'AKT1': 'P31749',
  'ERBB2': 'P04626',
};

async function resolveUniprotId(gene: string): Promise<string | null> {
  const upper = gene.toUpperCase();
  
  // Check hardcoded map first
  if (COMMON_GENES[upper]) {
    return COMMON_GENES[upper];
  }
  
  // Dynamic lookup
  try {
    const response = await fetch(
      `${UNIPROT_API}/search?query=gene:${gene}+AND+reviewed:true&format=json&limit=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.[0]?.primaryAccession || null;
  } catch {
    return null;
  }
}

// ==========================================
// FETCH UNIPROT DATA
// ==========================================

interface UniprotFeature {
  type: string;
  location: {
    start: { value: number };
    end: { value: number };
  };
  description?: string;
}

interface UniprotData {
  primaryAccession: string;
  proteinDescription?: {
    recommendedName?: {
      fullName?: { value: string };
    };
  };
  genes?: Array<{ geneName?: { value: string } }>;
  sequence?: { length: number };
  features?: UniprotFeature[];
}

async function fetchUniprotData(uniprotId: string): Promise<UniprotData | null> {
  const cacheKey = `uniprot:${uniprotId}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const response = await fetch(`${UNIPROT_API}/${uniprotId}.json`);
    if (!response.ok) return null;
    
    const data = await response.json();
    CACHE.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch {
    return null;
  }
}

// ==========================================
// EXTRACT DOMAINS
// ==========================================

function extractDomains(features: UniprotFeature[]): CuratedProteinInfo['domains'] {
  return features
    .filter(f => DOMAIN_FEATURES.includes(f.type))
    .map(f => ({
      name: f.description || f.type,
      start: f.location.start.value,
      end: f.location.end.value,
      description: f.description,
    }))
    .filter(d => d.start && d.end); // Remove incomplete
}

// ==========================================
// EXTRACT FUNCTIONAL SITES
// ==========================================

function extractFunctionalSites(features: UniprotFeature[]): CuratedProteinInfo['functionalSites'] {
  return features
    .filter(f => FUNCTIONAL_SITE_FEATURES.includes(f.type))
    .map(f => ({
      type: mapSiteType(f.type),
      residue: f.location.start.value,
      description: f.description,
    }))
    .filter(s => s.residue); // Remove incomplete
}

function mapSiteType(uniprotType: string): 'active_site' | 'binding_site' | 'metal_binding' | 'disulfide_bond' {
  switch (uniprotType) {
    case 'Active site': return 'active_site';
    case 'Binding site': return 'binding_site';
    case 'Metal binding': return 'metal_binding';
    case 'Disulfide bond': return 'disulfide_bond';
    default: return 'binding_site';
  }
}

// ==========================================
// VARIANT POSITION VALIDATION
// ==========================================

export function validateVariantPosition(
  residueNumber: number, 
  proteinLength: number
): VariantValidationError | null {
  if (residueNumber < 1) {
    return {
      error: true,
      code: 'INVALID_POSITION',
      message: `Residue position ${residueNumber} is invalid (must be >= 1)`,
      details: { providedPosition: residueNumber, proteinLength },
    };
  }
  
  if (residueNumber > proteinLength) {
    return {
      error: true,
      code: 'INVALID_POSITION',
      message: `Residue position ${residueNumber} exceeds protein length ${proteinLength}`,
      details: { providedPosition: residueNumber, proteinLength },
    };
  }
  
  return null;
}

// ==========================================
// FIND DOMAIN FOR POSITION
// ==========================================

function findDomainForPosition(
  domains: CuratedProteinInfo['domains'], 
  position: number
): string | null {
  const domain = domains.find(d => position >= d.start && position <= d.end);
  return domain ? domain.name : null;
}

// ==========================================
// FIND NEAREST FUNCTIONAL SITE
// ==========================================

function findNearestSite(
  sites: CuratedProteinInfo['functionalSites'], 
  position: number
): { near: boolean; distance: number | null } {
  if (sites.length === 0) {
    return { near: false, distance: null };
  }
  
  const distances = sites.map(s => Math.abs(s.residue - position));
  const minDistance = Math.min(...distances);
  
  // "Near" = within 10 residues in sequence
  return { near: minDistance <= 10, distance: minDistance };
}

// ==========================================
// MAIN CURATOR FUNCTION
// ==========================================

export async function curateUniprotData(
  geneOrUniprotId: string,
  residueNumber: number
): Promise<CuratedProteinInfo> {
  // 1. Resolve UniProt ID
  let uniprotId = geneOrUniprotId;
  if (!geneOrUniprotId.match(/^[A-Z][0-9][A-Z0-9]{3}[0-9]$/)) {
    // Looks like a gene name, not UniProt ID
    const resolved = await resolveUniprotId(geneOrUniprotId);
    if (!resolved) {
      throw new Error(`Could not resolve gene ${geneOrUniprotId} to UniProt ID`);
    }
    uniprotId = resolved;
  }
  
  // 2. Fetch UniProt data
  const data = await fetchUniprotData(uniprotId);
  if (!data) {
    throw new Error(`Could not fetch UniProt data for ${uniprotId}`);
  }
  
  // 3. Extract protein info
  const proteinLength = data.sequence?.length || 0;
  const geneName = data.genes?.[0]?.geneName?.value || geneOrUniprotId;
  const proteinName = data.proteinDescription?.recommendedName?.fullName?.value || 'Unknown protein';
  
  // 4. Validate position BEFORE any further processing
  const validationError = validateVariantPosition(residueNumber, proteinLength);
  if (validationError) {
    throw new Error(validationError.message);
  }
  
  // 5. Extract domains and sites
  const features = data.features || [];
  const domains = extractDomains(features);
  const functionalSites = extractFunctionalSites(features);
  
  // 6. Analyze variant position
  const variantInDomain = findDomainForPosition(domains, residueNumber);
  const siteAnalysis = findNearestSite(functionalSites, residueNumber);
  
  return {
    gene: geneName,
    uniprotId,
    proteinName,
    proteinLength,
    domains,
    functionalSites,
    variantPosition: residueNumber,
    variantInDomain,
    nearFunctionalSite: siteAnalysis.near,
    distanceToNearestSite: siteAnalysis.distance,
  };
}

// ==========================================
// GENERATE UNKNOWNS
// ==========================================

export function generateUnknowns(
  curatedInfo: CuratedProteinInfo,
  coverage: EvidenceCoverage
): ExplicitUnknowns {
  const items: string[] = [];
  
  // Structure unknowns
  if (coverage.structure.status === 'none') {
    items.push(UNKNOWN_MESSAGES.NO_STRUCTURE);
  } else if (coverage.structure.status === 'experimental' || coverage.structure.status === 'predicted') {
    items.push(UNKNOWN_MESSAGES.MAPPING_NOT_COMPUTED);
  }
  
  // Clinical unknowns
  if (coverage.clinical.status === 'none') {
    items.push(UNKNOWN_MESSAGES.NO_CLINICAL);
  }
  
  // Domain unknowns
  if (!curatedInfo.variantInDomain) {
    items.push(UNKNOWN_MESSAGES.OUTSIDE_DOMAIN);
  }
  
  // Functional site unknowns
  if (!curatedInfo.nearFunctionalSite) {
    items.push(UNKNOWN_MESSAGES.NO_FUNCTIONAL_SITE);
  }
  
  // Literature unknowns
  if (coverage.literature.variantSpecificCount === 0) {
    items.push(UNKNOWN_MESSAGES.NO_LITERATURE);
  }
  
  // Determine severity
  let severity: 'critical' | 'moderate' | 'minor' = 'minor';
  if (items.length >= 4) severity = 'critical';
  else if (items.length >= 2) severity = 'moderate';
  
  return { items, severity };
}

// ==========================================
// BUILD EVIDENCE COVERAGE
// ==========================================

export async function buildEvidenceCoverage(
  curatedInfo: CuratedProteinInfo,
  structureData: { 
    source: 'PDB' | 'AlphaFold'; 
    id: string; 
    resolution?: number;
    paeUrl?: string; // Phase-4
    sifts?: {
      mapped: boolean;
      pdbId: string;
      chain: string;
      pdbResidue: string;
      source: string;
    } | null;
    availableStructures?: Array<{
      id: string;
      source: string;
      resolution?: number;
      chain: string;
      mapped: boolean;
      paeUrl?: string; // Phase-4
    }>;
  } | null,
  clinvarData: { 
    significance: string; 
    reviewStatus: string;
    stars: number;
    clinvarId: string;
    url: string;
    conditions: string[];
  } | null,
  literatureData: { 
    count: number; 
    query: string;
    papers: Array<{
      title: string;
      url: string;
      source: string;
      pubDate: string;
    }>;
  } | null
): Promise<EvidenceCoverage> {
  return {
    structure: structureData ? {
      status: structureData.source === 'PDB' ? 'experimental' : 'predicted',
      source: structureData.source,
      id: structureData.id,
      resolution: structureData.resolution,
      paeUrl: structureData.paeUrl, // Phase-4
      note: structureData.sifts?.mapped ? undefined : UNKNOWN_MESSAGES.MAPPING_NOT_COMPUTED,
      sifts: structureData.sifts || undefined,
      availableStructures: structureData.availableStructures,
    } : {
      status: 'none',
    },
    
    clinical: clinvarData ? {
      status: mapClinicalSignificance(clinvarData.significance),
      source: 'ClinVar',
      significance: clinvarData.significance,
      reviewStatus: clinvarData.reviewStatus,
      stars: clinvarData.stars,
      clinvarId: clinvarData.clinvarId,
      url: clinvarData.url,
      conditions: clinvarData.conditions,
    } : {
      status: 'none',
    },
    
    domain: {
      inAnnotatedDomain: !!curatedInfo.variantInDomain,
      domainName: curatedInfo.variantInDomain || undefined,
    },
    
    literature: {
      variantSpecificCount: literatureData?.count || 0,
      query: literatureData?.query,
      papers: literatureData?.papers.map(p => ({
        title: p.title,
        url: p.url,
        source: p.source,
        year: p.pubDate.split(' ')[0] // Extract year roughly
      })),
      note: (literatureData?.count || 0) === 0 ? UNKNOWN_MESSAGES.NO_LITERATURE : undefined,
    },
  };
}

function mapClinicalSignificance(sig: string): EvidenceCoverage['clinical']['status'] {
  const lower = sig.toLowerCase();
  if (lower.includes('pathogenic') && !lower.includes('likely')) return 'pathogenic';
  if (lower.includes('likely pathogenic')) return 'likely_pathogenic';
  if (lower.includes('benign') && !lower.includes('likely')) return 'benign';
  if (lower.includes('likely benign')) return 'likely_benign';
  if (lower.includes('uncertain') || lower.includes('vus')) return 'uncertain';
  return 'none';
}
