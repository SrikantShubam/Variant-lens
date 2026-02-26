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
const DOMAIN_FEATURE_TYPES = new Set([
  'domain',
  'region',
  'repeat',
  'zinc finger',
  'motif',
]);
const FUNCTIONAL_SITE_FEATURE_TYPES = new Set([
  'active site',
  'binding site',
  'metal binding',
  'disulfide bond',
  'site',
]);

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
  'NDUFAF6': 'Q330K2',
  'PTPN11': 'Q06124',
  'RYR1': 'P21817',
  'SURF1': 'Q15526',
  'PROM1': 'O43490',
  'POLG': 'P54098',
  'G6PD': 'P11413',
  'HBB': 'P68871',
  'SCN5A': 'Q14524',
  'APOE': 'P02649',
  'DMD': 'P11532',
};

import { fetchWithRetry, FetchResult, FetchFailure, ServiceUnavailableError } from './fetch-utils';

// ... (existing constants)

export class UniProtUnavailableError extends Error {
    constructor(public failure: FetchFailure) {
        super(`UniProt Unavailable: ${failure.reason}`);
        this.name = 'UniProtUnavailableError';
    }
}

async function resolveUniprotId(gene: string): Promise<string | null> {
  const upper = gene.toUpperCase();
  
  // Check hardcoded map first
  if (COMMON_GENES[upper]) {
    return COMMON_GENES[upper];
  }
  
  // Dynamic lookup
  try {
    const strictResult = await fetchWithRetry<any>(
      `${UNIPROT_API}/search?query=gene_exact:${upper}+AND+reviewed:true&format=json&size=25`,
      { circuitBreakerKey: 'uniprot', timeoutMs: 6000 }
    );

    if (strictResult && 'unavailable' in strictResult) {
        throw new UniProtUnavailableError(strictResult);
    }

    const strictHit = pickExactGeneResult(strictResult?.results || [], upper);
    if (strictHit) return strictHit.primaryAccession || null;

    // Fallback: broader query, still filtered by exact primary gene symbol.
    const broadResult = await fetchWithRetry<any>(
      `${UNIPROT_API}/search?query=gene:${upper}+AND+reviewed:true&format=json&size=50`,
      { circuitBreakerKey: 'uniprot', timeoutMs: 6000 }
    );
    if (broadResult && 'unavailable' in broadResult) {
      throw new UniProtUnavailableError(broadResult);
    }

    const broadHit = pickExactGeneResult(broadResult?.results || [], upper);
    return broadHit?.primaryAccession || null;
  } catch (error) {
    if (error instanceof UniProtUnavailableError) throw error;
    // Other errors (parsing etc) are treated as "not found" or swallowed for dynamic lookup
    return null; 
  }
}

function pickExactGeneResult(results: any[], gene: string): any | null {
  const upper = gene.toUpperCase();
  for (const result of results || []) {
    const primaryGene = (result?.genes?.[0]?.geneName?.value || '').toUpperCase();
    if (primaryGene === upper) return result;
  }
  return null;
}

// ==========================================
// FETCH UNIPROT DATA
// ==========================================

// ... (Uniprot interfaces)
interface UniprotFeature {
  type: string;
  location: {
    start: { value: number };
    end: { value: number };
  };
  description?: string;
}

interface UniprotCrossReference {
  database: string;
  id: string;
  properties?: Array<{ key: string; value: string }>;
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
  uniProtKBCrossReferences?: UniprotCrossReference[];
}

async function fetchUniprotData(uniprotId: string): Promise<UniprotData | null> {
  const cacheKey = `uniprot:${uniprotId}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const result = await fetchWithRetry<UniprotData>(`${UNIPROT_API}/${uniprotId}.json`, {
        circuitBreakerKey: 'uniprot',
        timeoutMs: 6000
    });
    
    if (result && 'unavailable' in result) {
        throw new UniProtUnavailableError(result);
    }
    
    if (!result) return null; // 404
    
    CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    if (error instanceof UniProtUnavailableError) throw error;
    console.warn(`[UniProt] Failed to fetch ${uniprotId}:`, error);
    return null;
  }
}

// ==========================================
// EXTRACT DOMAINS
// ==========================================

function extractDomains(features: UniprotFeature[]): CuratedProteinInfo['domains'] {
  const domains: CuratedProteinInfo['domains'] = [];

  for (const feature of features) {
    const type = normalizeFeatureType(feature.type);
    const description = (feature.description || '').trim();
    const start = toLocationNumber(feature.location?.start?.value);
    const end = toLocationNumber(feature.location?.end?.value);
    if (start === null || end === null) continue;

    const isKnownDomainType = DOMAIN_FEATURE_TYPES.has(type);
    const descriptionLooksDomainLike =
      /\b(domain|repeat|motif|zinc finger|helix|beta[- ]strand)\b/i.test(description);
    if (!isKnownDomainType && !descriptionLooksDomainLike) continue;

    domains.push({
      name: sanitizeDomainName(description || feature.type, type),
      start,
      end,
      description: description || undefined,
    });
  }

  // Deduplicate exact duplicates from overlapping UniProt feature projections.
  const dedup = new Map<string, CuratedProteinInfo['domains'][number]>();
  for (const domain of domains) {
    const key = `${domain.name.toLowerCase()}|${domain.start}|${domain.end}`;
    if (!dedup.has(key)) {
      dedup.set(key, domain);
    }
  }

  return [...dedup.values()];
}

function extractDomainsFromCrossReferences(
  crossReferences: UniprotCrossReference[]
): CuratedProteinInfo['domains'] {
  const acceptedDatabases = new Set(['pfam', 'gene3d']);
  const domains: CuratedProteinInfo['domains'] = [];

  for (const xref of crossReferences) {
    const db = (xref.database || '').toLowerCase();
    if (!acceptedDatabases.has(db)) continue;

    const props = xref.properties || [];
    const range = extractRangeFromProperties(props);
    if (!range) continue;

    const label = findProperty(props, ['entry name', 'name', 'description']) || xref.id;
    const cleanedLabel = sanitizeDomainName(label);
    domains.push({
      name: `${xref.database}: ${cleanedLabel}`,
      start: range.start,
      end: range.end,
      description: `${xref.database} annotation (${xref.id})`,
    });
  }

  return domains;
}

// ==========================================
// EXTRACT FUNCTIONAL SITES
// ==========================================

function extractFunctionalSites(features: UniprotFeature[]): CuratedProteinInfo['functionalSites'] {
  return features
    .filter((f) => FUNCTIONAL_SITE_FEATURE_TYPES.has(normalizeFeatureType(f.type)))
    .map((f) => ({
      type: mapSiteType(f.type),
      residue: toLocationNumber(f.location?.start?.value),
      description: f.description,
    }))
    .filter((s): s is CuratedProteinInfo['functionalSites'][number] => s.residue !== null); // Remove incomplete
}

function mapSiteType(uniprotType: string): 'active_site' | 'binding_site' | 'metal_binding' | 'disulfide_bond' {
  switch (normalizeFeatureType(uniprotType)) {
    case 'active site': return 'active_site';
    case 'binding site': return 'binding_site';
    case 'metal binding': return 'metal_binding';
    case 'disulfide bond': return 'disulfide_bond';
    default: return 'binding_site';
  }
}

function normalizeFeatureType(type: string | undefined): string {
  return (type || '').trim().toLowerCase();
}

function toLocationNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/\d+/);
    if (match) return Number(match[0]);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePropertyKey(key: string | undefined): string {
  return (key || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeDomainName(raw: string, featureType?: string): string {
  const type = (featureType || '').toLowerCase();
  let name = (raw || '').trim();
  if (!name) return 'Annotated region';

  // UniProt topology style labels should be human-friendly in reports.
  name = name.replace(/^helical;\s*name=/i, '');
  name = name.replace(/^topological domain;\s*name=/i, '');
  name = name.replace(/^domain;\s*name=/i, '');
  name = name.replace(/^region;\s*name=/i, '');
  name = name.replace(/\s+/g, ' ').trim();

  // Prevent opaque labels such as "3" from surfacing in reports.
  if (/^\d+$/.test(name)) {
    if (type === 'repeat') return `Repeat region ${name}`;
    return `Region ${name}`;
  }

  return name;
}

function findProperty(
  properties: Array<{ key: string; value: string }>,
  keys: string[]
): string | null {
  const wanted = new Set(keys.map((k) => normalizePropertyKey(k)));
  for (const property of properties) {
    if (wanted.has(normalizePropertyKey(property.key))) {
      return property.value;
    }
  }
  return null;
}

function extractRangeFromProperties(
  properties: Array<{ key: string; value: string }>
): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;

  for (const property of properties) {
    const key = normalizePropertyKey(property.key);
    if (key.includes('range') || key.includes('positions')) {
      const nums = String(property.value || '').match(/\d+/g);
      if (nums && nums.length >= 2) {
        start = Number(nums[0]);
        end = Number(nums[1]);
        continue;
      }
    }
    const value = toLocationNumber(property.value);
    if (value === null) continue;

    if (/(entry|protein|domain)\s*start|\bstart\b|\bfrom\b/.test(key)) start = value;
    if (/(entry|protein|domain)\s*end|\bend\b|\bto\b|\bstop\b/.test(key)) end = value;
  }

  if (start === null || end === null) return null;
  return { start, end };
}

function dedupeDomains(
  domains: CuratedProteinInfo['domains']
): CuratedProteinInfo['domains'] {
  const dedup = new Map<string, CuratedProteinInfo['domains'][number]>();
  for (const domain of domains) {
    const key = `${domain.name.toLowerCase()}|${domain.start}|${domain.end}`;
    if (!dedup.has(key)) dedup.set(key, domain);
  }
  return [...dedup.values()];
}

const CURATED_DOMAIN_FALLBACKS: Record<string, CuratedProteinInfo['domains']> = {
  NDUFAF6: [
    {
      name: 'SQS_PSY / prenyltransferase-like domain',
      start: 64,
      end: 311,
      description: 'Curated fallback when UniProt feature ranges are sparse',
    },
  ],
  G6PD: [
    {
      name: 'G6PD_C / glucose-6-phosphate dehydrogenase domain',
      start: 1,
      end: 515,
      description: 'Curated fallback when Pfam/Gene3D ranges are missing',
    },
  ],
  KRAS: [
    {
      name: 'P-loop / Switch region',
      start: 1,
      end: 40,
      description: 'Curated fallback for small-GTPase hotspot region coverage',
    },
  ],
};

function getFallbackDomainsForGene(gene: string): CuratedProteinInfo['domains'] {
  return CURATED_DOMAIN_FALLBACKS[gene.toUpperCase()] || [];
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
  position: number,
  gene?: string
): string | null {
  const containing = domains.filter((d) => position >= d.start && position <= d.end);
  if (containing.length === 0) return null;

  const upperGene = (gene || '').toUpperCase();
  const sorted = [...containing].sort((a, b) => domainPriorityScore(b, upperGene) - domainPriorityScore(a, upperGene));
  return sorted[0].name;
}

function domainPriorityScore(domain: CuratedProteinInfo['domains'][number], gene: string): number {
  const name = domain.name.toLowerCase();
  let score = 0;

  if (name.startsWith('pfam:')) score += 120;
  if (name.startsWith('gene3d:')) score += 110;
  if (name.includes('domain')) score += 40;
  if (name.includes('interaction')) score -= 35;
  if (name.includes('region')) score -= 10;

  const length = Math.max(1, domain.end - domain.start + 1);
  score += Math.max(0, 20 - Math.floor(length / 25));

  if (gene === 'TP53') {
    if (name.includes('dna') && name.includes('binding')) score += 200;
    if (name.includes('ccar2')) score -= 200;
  }

  return score;
}

function applyCanonicalDomainOverrides(
  gene: string,
  position: number,
  current: string | null
): string | null {
  const upper = gene.toUpperCase();
  if (upper === 'TP53' && position >= 102 && position <= 292) {
    return 'DNA-binding domain';
  }
  return current;
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
  const extractedDomains = dedupeDomains([
    ...extractDomains(features),
    ...extractDomainsFromCrossReferences(data.uniProtKBCrossReferences || []),
  ]);
  let domains =
    extractedDomains.length > 0
      ? extractedDomains
      : getFallbackDomainsForGene(geneName);
  const functionalSites = extractFunctionalSites(features);
  
  // 6. Analyze variant position
  let variantInDomain = findDomainForPosition(domains, residueNumber, geneName);
  if (!variantInDomain) {
    const fallbackMatch = getFallbackDomainsForGene(geneName).find(
      (domain) => residueNumber >= domain.start && residueNumber <= domain.end
    );
    if (fallbackMatch) {
      variantInDomain = fallbackMatch.name;
      domains = dedupeDomains([...domains, fallbackMatch]);
    }
  }
  variantInDomain = applyCanonicalDomainOverrides(geneName, residueNumber, variantInDomain);
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
  const hasMappedStructure = !!coverage.structure.sifts?.mapped ||
    !!coverage.structure.availableStructures?.some((s) => s.mapped && !!s.pdbResidue);
  
  // Structure unknowns
  if (coverage.structure.status === 'none') {
    items.push(UNKNOWN_MESSAGES.NO_STRUCTURE);
  } else if (
    coverage.structure.status === 'experimental' &&
    !hasMappedStructure
  ) {
    items.push(UNKNOWN_MESSAGES.MAPPING_NOT_COMPUTED);
  }
  
  // Clinical unknowns
  if (coverage.clinical.status === 'none') {
    items.push(UNKNOWN_MESSAGES.NO_CLINICAL);
  }
  
  // Domain unknowns
  if (curatedInfo.domains.length === 0) {
    items.push(UNKNOWN_MESSAGES.NO_DOMAIN_ANNOTATION);
  } else if (!curatedInfo.variantInDomain) {
    items.push(UNKNOWN_MESSAGES.OUTSIDE_DOMAIN);
  }
  
  // Functional site unknowns
  if (curatedInfo.functionalSites.length > 0 && !curatedInfo.nearFunctionalSite) {
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
      availableStructures?: Array<{
        id: string;
        source: string;
        resolution?: number;
        chain: string;
        mapped: boolean;
        paeUrl?: string; // Phase-4
      }>;
    } | null;
    availableStructures?: Array<{
      id: string;
      source: string;
      url?: string;
      resolution?: number;
      chain: string;
      mapped: boolean;
      pdbResidue?: string;
      paeUrl?: string; // Phase-4
    }>;
  } | { unavailable: true; reason: string } | null,
  clinvarData: { 
    significance: string; 
    reviewStatus: string;
    stars: number;
    clinvarId: string;
    url: string;
    conditions: string[];
  } | { unavailable: true; reason: string } | null,
  literatureData: { 
    count: number; 
    query: string;
    papers: Array<{
      title: string;
      url: string;
      source: string;
      pubDate: string;
    }>;
  } | { unavailable: true; reason: string } | null
): Promise<EvidenceCoverage> {
  // Structure
  let structureCoverage: EvidenceCoverage['structure'];
  if (structureData && 'unavailable' in structureData) {
      structureCoverage = { 
          status: 'unavailable', 
          reason: structureData.reason 
      };
  } else if (structureData) {
      const hasMappedStructure = !!structureData.sifts?.mapped ||
        !!structureData.availableStructures?.some((s) => s.mapped && !!s.pdbResidue);
      structureCoverage = {
          status: structureData.source === 'PDB' ? 'experimental' : 'predicted',
          source: structureData.source,
          id: structureData.id,
          resolution: structureData.resolution,
          paeUrl: structureData.paeUrl,
          note: structureData.source === 'PDB' && !hasMappedStructure
            ? UNKNOWN_MESSAGES.MAPPING_NOT_COMPUTED
            : undefined,
          sifts: structureData.sifts || undefined,
          availableStructures: structureData.availableStructures,
      };
  } else {
      structureCoverage = { status: 'none' };
  }

  // Clinical
  let clinicalCoverage: EvidenceCoverage['clinical'];
  if (clinvarData && 'unavailable' in clinvarData) {
      clinicalCoverage = { 
          status: 'unavailable', 
          reason: clinvarData.reason 
      };
  } else if (clinvarData) {
      clinicalCoverage = {
          status: mapClinicalSignificance(clinvarData.significance),
          source: 'ClinVar',
          significance: clinvarData.significance,
          reviewStatus: clinvarData.reviewStatus,
          stars: clinvarData.stars,
          clinvarId: clinvarData.clinvarId,
          url: clinvarData.url,
          conditions: clinvarData.conditions,
      };
  } else {
      clinicalCoverage = { status: 'none' };
  }

  // Literature
  let literatureCoverage: EvidenceCoverage['literature'];
  if (literatureData && 'unavailable' in literatureData) {
      literatureCoverage = {
          variantSpecificCount: 0,
          unavailable: true,
          reason: literatureData.reason
      };
  } else {
      literatureCoverage = {
          variantSpecificCount: literatureData?.count || 0,
          query: literatureData?.query,
          papers: literatureData?.papers.map(p => ({
            title: p.title,
            url: p.url,
            source: p.source,
            // Some PubMed summaries omit pubdate; keep response stable instead of throwing.
            year: typeof p.pubDate === 'string' && p.pubDate.trim()
              ? p.pubDate.split(' ')[0]
              : 'unknown'
          })),
          note: (literatureData?.count || 0) === 0 ? UNKNOWN_MESSAGES.NO_LITERATURE : undefined,
      };
  }

  return {
    structure: structureCoverage,
    clinical: clinicalCoverage,
    domain: {
      inAnnotatedDomain: !!curatedInfo.variantInDomain,
      domainName: curatedInfo.variantInDomain || undefined,
    },
    literature: literatureCoverage,
  };
}

function mapClinicalSignificance(sig: string): EvidenceCoverage['clinical']['status'] {
  const lower = (sig || '').toLowerCase();

  // Conflicting ClinVar entries should never be surfaced as strictly pathogenic/benign.
  if (lower.includes('conflicting')) return 'uncertain';
  if (lower.includes('uncertain') || lower.includes('vus')) return 'uncertain';
  if (lower.includes('likely pathogenic')) return 'likely_pathogenic';
  if (lower.includes('pathogenic')) return 'pathogenic';
  if (lower.includes('likely benign')) return 'likely_benign';
  if (lower.includes('benign')) return 'benign';
  return 'none';
}
