/**
 * ClinVar API Client
 * 
 * Phase-2 Priority 1: Read-only ClinVar integration
 * 
 * CONSTRAINTS:
 * - Read-only: No scoring, no classification
 * - No interpretation: Just data
 * - Explicit missing: null when no entry
 */

export interface ClinVarResult {
  clinicalSignificance: string;
  reviewStatus: string;
  clinvarId: string;
  conditions: string[];
  lastUpdated: string;
  submitterCount: number;
}

// Cache to avoid repeated API calls
const clinvarCache = new Map<string, ClinVarResult | null>();

/**
 * Get ClinVar data for a variant
 * Returns null if no ClinVar entry exists (not an error)
 */
export async function getClinVarData(
  gene: string,
  proteinChange: string
): Promise<ClinVarResult | null> {
  const cacheKey = `${gene}:${proteinChange}`;
  
  if (clinvarCache.has(cacheKey)) {
    return clinvarCache.get(cacheKey) || null;
  }

  try {
    // Step 1: Search for the variant in ClinVar
    const searchResult = await searchClinVar(gene, proteinChange);
    
    if (!searchResult || searchResult.esearchresult.count === '0') {
      clinvarCache.set(cacheKey, null);
      return null;
    }

    // Step 2: Get the first matching variant ID
    const variantId = searchResult.esearchresult.idlist[0];
    
    // Step 3: Fetch variant details
    const details = await fetchClinVarDetails(variantId);
    
    if (!details) {
      clinvarCache.set(cacheKey, null);
      return null;
    }

    clinvarCache.set(cacheKey, details);
    return details;

  } catch (error) {
    console.error('[ClinVar] API error:', error);
    clinvarCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Search ClinVar for a variant
 */
async function searchClinVar(gene: string, proteinChange: string): Promise<any> {
  // Clean protein change (remove 'p.' prefix if present)
  const cleanChange = proteinChange.replace(/^p\./, '');
  
  // Build search query
  // Try multiple formats to increase match chance
  const query = encodeURIComponent(
    `${gene}[gene] AND (${cleanChange}[variant name] OR ${proteinChange}[variant name])`
  );
  
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${query}&retmode=json&retmax=1`;
  
  console.log(`[ClinVar] Searching: ${gene} ${proteinChange}`);
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ClinVar search failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch details for a specific ClinVar ID
 */
async function fetchClinVarDetails(clinvarId: string): Promise<ClinVarResult | null> {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${clinvarId}&retmode=json`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ClinVar fetch failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Parse the response
  const result = data.result?.[clinvarId];
  
  if (!result) {
    return null;
  }

  // Extract clinical significance
  const clinicalSignificance = extractClinicalSignificance(result);
  const reviewStatus = extractReviewStatus(result);
  const conditions = extractConditions(result);
  
  return {
    clinicalSignificance,
    reviewStatus,
    clinvarId,
    conditions,
    lastUpdated: result.supporting_submissions?.last_evaluated || 'Unknown',
    submitterCount: result.supporting_submissions?.scv?.length || 0,
  };
}

/**
 * Extract clinical significance from ClinVar response
 */
function extractClinicalSignificance(result: any): string {
  // Try different fields where significance might be stored
  if (result.clinical_significance?.description) {
    return result.clinical_significance.description;
  }
  
  if (result.germline_classification?.description) {
    return result.germline_classification.description;
  }
  
  if (result.clinical_significance) {
    return String(result.clinical_significance);
  }
  
  return 'Unknown';
}

/**
 * Extract review status from ClinVar response
 */
function extractReviewStatus(result: any): string {
  if (result.clinical_significance?.review_status) {
    return result.clinical_significance.review_status;
  }
  
  if (result.germline_classification?.review_status) {
    return result.germline_classification.review_status;
  }
  
  return 'no assertion provided';
}

/**
 * Extract conditions from ClinVar response
 */
function extractConditions(result: any): string[] {
  const conditions: string[] = [];
  
  if (result.trait_set) {
    for (const traitSet of result.trait_set) {
      if (traitSet.trait_name) {
        conditions.push(traitSet.trait_name);
      }
    }
  }
  
  if (result.conditions) {
    if (Array.isArray(result.conditions)) {
      conditions.push(...result.conditions);
    } else if (typeof result.conditions === 'string') {
      conditions.push(result.conditions);
    }
  }
  
  return conditions;
}

/**
 * Format review status as stars (for UI display)
 */
export function getReviewStars(reviewStatus: string): number {
  const status = reviewStatus.toLowerCase();
  
  if (status.includes('practice guideline')) return 4;
  if (status.includes('expert panel')) return 4;
  if (status.includes('multiple submitters')) return 3;
  if (status.includes('single submitter')) return 2;
  if (status.includes('conflicting')) return 2;
  if (status.includes('no assertion criteria')) return 1;
  
  return 0;
}

/**
 * Get ClinVar URL for a variant
 */
export function getClinVarUrl(clinvarId: string): string {
  return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`;
}
