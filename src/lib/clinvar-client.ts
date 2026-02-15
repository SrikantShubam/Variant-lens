/**
 * ClinVar API Client
 * 
 * Allele-exact matching with structured field parsing.
 * Title parsing is fallback only — title-parsed alleles cap at 'partial'.
 * 
 * MATCHING RULES:
 * - 'exact': gene + ref + pos + alt match from STRUCTURED DATA only
 * - 'partial': allele matches from title, or gene+pos only, or transcript mismatch
 * - 'none': no meaningful match (stars suppressed — no tie-break inflation)
 * 
 * CONSTRAINTS:
 * - Read-only: No scoring, no classification
 * - No interpretation: Just data
 * - Explicit missing: null when no entry
 * - Transcript: truly hard constraint — if input has NM_, candidate MUST match
 */

import { fetchWithRetry, FetchResult, FetchFailure } from './fetch-utils';
import { toThreeLetter, AMINO_ACIDS } from './variant';

// ==========================================
// TYPES
// ==========================================

export interface ClinVarResult {
  clinicalSignificance: string;
  reviewStatus: string;
  clinvarId: string;
  conditions: string[];
  lastUpdated: string;
  submitterCount: number;
  title: string;
  matchType: 'exact' | 'partial' | 'none';
  /** Raw esummary item — used by structured parser, not serialized to API */
  _raw?: any;
}

/** Canonical allele representation for comparison */
interface ParsedAllele {
  gene: string;
  ref: string;     // 3-letter (e.g. "Val")
  pos: number;
  alt: string;     // 3-letter (e.g. "Glu")
  transcript?: string;  // NM_... if available
}

// ==========================================
// CACHE
// ==========================================
const clinvarCache = new Map<string, FetchResult<ClinVarResult>>();

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Get ClinVar data for a variant
 * Returns null if no ClinVar entry exists (not an error)
 * Returns FetchFailure if the API is unavailable
 */
export async function getClinVarData(
  gene: string,
  proteinChange: string
): Promise<FetchResult<ClinVarResult>> {
  const cacheKey = `${gene}:${proteinChange}`;
  
  if (clinvarCache.has(cacheKey)) {
    return clinvarCache.get(cacheKey)!;
  }

  try {
    // Step 1: Search for the variant in ClinVar (fetch more candidates)
    const searchResult = await searchClinVar(gene, proteinChange);
    
    // Handle resiliency failure in search
    if (searchResult && 'unavailable' in searchResult) {
      clinvarCache.set(cacheKey, searchResult);
      return searchResult;
    }

    if (!searchResult || !searchResult.esearchresult.idlist || searchResult.esearchresult.idlist.length === 0) {
      clinvarCache.set(cacheKey, null);
      return null;
    }

    // Step 2: Get ALL variant IDs (up to retmax)
    const variantIds = searchResult.esearchresult.idlist;
    console.log(`[ClinVar] Found ${variantIds.length} candidates for ${gene} ${proteinChange}`);
    
    // Step 3: Fetch details for ALL candidates in one go
    const allDetails = await fetchClinVarSummaryBatch(variantIds);
    
    // Handle resiliency failure in summary fetch
    if ((allDetails as any).unavailable) {
        // If it's an array it's success, if it's an object with 'unavailable' it's failure
        // logic check: fetchClinVarSummaryBatch returns FetchResult<ClinVarResult[]>
        clinvarCache.set(cacheKey, allDetails as FetchFailure);
        return allDetails as FetchFailure;
    }
    
    // Type assertion: at this point allDetails is ClinVarResult[]
    const candidates = allDetails as ClinVarResult[];

    if (candidates.length === 0) {
      clinvarCache.set(cacheKey, null);
      return null;
    }

    // Step 4: Filter and Rank to find the BEST match (allele-safe)
    const bestMatch = pickBestClinVarEntry(candidates, gene, proteinChange);

    clinvarCache.set(cacheKey, bestMatch);
    return bestMatch;

  } catch (error) {
    console.error('[ClinVar] Unexpected error:', error);
    // This catches synchronous errors (e.g. parsing), NOT fetch errors which are handled by fetchWithRetry
    // Return a generic failure so UI doesn't crash
    const failure: FetchFailure = { 
        unavailable: true, 
        reason: 'unknown', 
        service: 'clinvar', 
        details: (error as Error).message 
    };
    clinvarCache.set(cacheKey, failure);
    return failure;
  }
}

// ==========================================
// ALLELE PARSING (structured fields + title fallback)
// ==========================================

/**
 * Parse a canonical allele from ClinVar summary structured fields.
 * Returns null if structured fields don't provide enough info.
 */
function parseAlleleFromStructuredFields(result: any): ParsedAllele | null {
  try {
    // Try variation_set → protein changes
    if (result.variation_set) {
      for (const vs of (Array.isArray(result.variation_set) ? result.variation_set : [result.variation_set])) {
        // variation_set may contain variant_type, protein_change, etc.
        if (vs.variation_name) {
          const parsed = parseProteinHGVS(vs.variation_name);
          if (parsed) return parsed;
        }
      }
    }

    // Try obj_type / protein_change fields (some ClinVar summary formats)
    if (result.protein_change) {
      const parsed = parseProteinHGVS(result.protein_change);
      if (parsed) return parsed;
    }

    // Try genes array for gene name + variant name parsing
    if (result.genes) {
      const geneNames = Array.isArray(result.genes) 
        ? result.genes.map((g: any) => g.symbol || g.name).filter(Boolean)
        : [];
      // If we have gene names, try parsing title with gene context
      if (geneNames.length > 0 && result.title) {
        const parsed = parseVariantFromTitle(result.title);
        if (parsed && geneNames.includes(parsed.gene)) {
          return parsed;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse protein HGVS string into canonical allele.
 * Handles: "p.Val600Glu", "p.V600E", "Val600Glu"
 */
function parseProteinHGVS(input: string): ParsedAllele | null {
  if (!input) return null;
  
  // Match patterns like: GENE(p.Val600Glu), NM_xxx(GENE):c.xxx (p.Val600Glu), p.Val600Glu
  const proteinPattern = /(?:([A-Z][A-Z0-9]+)\s*\()?\s*(?:p\.)?([A-Za-z]+?)(\d+)([A-Za-z]+|\*|Ter)\s*\)?/;
  const match = input.match(proteinPattern);
  if (!match) return null;

  const [, gene, rawRef, posStr, rawAlt] = match;
  const pos = parseInt(posStr, 10);
  if (isNaN(pos)) return null;

  // Normalize to 3-letter
  const ref = rawRef.length === 1 ? toThreeLetter(rawRef) : rawRef;
  const alt = rawAlt.length === 1 ? toThreeLetter(rawAlt) : rawAlt;

  // Validate amino acids
  if (!isValidAminoAcid(ref) || !isValidAminoAcid(alt)) return null;

  return { gene: gene || '', ref, pos, alt };
}

/**
 * Parse variant info from ClinVar title string. FALLBACK ONLY.
 * 
 * Handles common ClinVar title formats:
 * - "BRAF(p.Val600Glu)"
 * - "NM_004333.6(BRAF):c.1799T>A (p.Val600Glu)"
 * - "BRAF:p.V600E"
 * 
 * Returns null if parsing fails — callers must treat this as non-exact.
 */
function parseVariantFromTitle(title: string): ParsedAllele | null {
  if (!title) return null;

  // Try to extract transcript
  let transcript: string | undefined;
  const transcriptMatch = title.match(/(NM_\d+(?:\.\d+)?)/);
  if (transcriptMatch) {
    transcript = transcriptMatch[1];
  }

  // Try to extract gene name — appears before '(' or ':'
  let gene = '';
  const geneMatch = title.match(/^(?:NM_[\d.]+\()?([A-Z][A-Z0-9]+)[:(]/);
  if (geneMatch) {
    gene = geneMatch[1];
  }

  // Try to extract protein change (3-letter or 1-letter)
  // Look for p.Xxx000Xxx pattern
  const proteinMatch = title.match(/(?:p\.)?([A-Z][a-z]{2}|[A-Z])(\d+)([A-Z][a-z]{2}|[A-Z]|\*|Ter)/);
  if (!proteinMatch) return null;

  const [, rawRef, posStr, rawAlt] = proteinMatch;
  const pos = parseInt(posStr, 10);
  if (isNaN(pos)) return null;

  // Normalize to 3-letter
  const ref = rawRef.length === 1 ? toThreeLetter(rawRef) : rawRef;
  const alt = rawAlt.length === 1 ? toThreeLetter(rawAlt) : rawAlt;

  if (!isValidAminoAcid(ref) || !isValidAminoAcid(alt)) return null;

  return { gene, ref, pos, alt, transcript };
}

function isValidAminoAcid(aa: string): boolean {
  if (aa === '*' || aa === 'Ter') return true;
  // Check 3-letter code
  if (aa in AMINO_ACIDS) return true;
  // Check 1-letter code
  const allOneLetter = new Set(Object.values(AMINO_ACIDS));
  return allOneLetter.has(aa);
}

// ==========================================
// MATCHING ENGINE (allele-safe)
// ==========================================

/**
 * Pick best ClinVar entry using allele-equality matching.
 * 
 * RULES:
 * 1. 'exact' requires allele equality: gene + ref + pos + alt from structured data
 * 2. Parse failure → 'partial' or 'none', NEVER 'exact'
 * 3. Stars only used as tie-break among same-allele candidates
 * 4. Transcript mismatch → 'partial' even if allele matches
 */
function pickBestClinVarEntry(
    candidates: ClinVarResult[], 
    gene: string, 
    proteinChange: string
): ClinVarResult | null {
    
    // Parse the INPUT variant into canonical form
    const inputAllele = parseInputToAllele(gene, proteinChange);
    if (!inputAllele) {
      console.warn(`[ClinVar] Could not parse input allele: ${gene} ${proteinChange}`);
      // Can't do allele matching — return best by gene match only as 'partial'
      const geneMatches = candidates.filter(c => (c.title || '').includes(gene));
      if (geneMatches.length > 0) {
        const best = geneMatches.sort((a, b) => getReviewStars(b.reviewStatus) - getReviewStars(a.reviewStatus))[0];
        best.matchType = 'partial';
        return best;
      }
      return null;
    }

    // Score each candidate
    const scored = candidates.map(c => {
        // Try structured fields first (from raw esummary), then title as fallback
        const structuredAllele = parseAlleleFromStructuredFields(c._raw || {});
        const titleAllele = !structuredAllele ? parseVariantFromTitle(c.title || '') : null;
        const candidateAllele = structuredAllele || titleAllele;
        const alleleFromStructured = !!structuredAllele; // Track provenance
        
        let matchType: 'exact' | 'partial' | 'none' = 'none';
        let score = 0;
        let parseSucceeded = !!candidateAllele;

        if (candidateAllele) {
          // Gene check
          const geneMatch = candidateAllele.gene === '' || // unknown gene in candidate is OK
            candidateAllele.gene.toUpperCase() === inputAllele.gene.toUpperCase();
          
          // Position check
          const posMatch = candidateAllele.pos === inputAllele.pos;
          
          // Allele check (ref + alt)
          const refMatch = candidateAllele.ref.toLowerCase() === inputAllele.ref.toLowerCase();
          const altMatch = candidateAllele.alt.toLowerCase() === inputAllele.alt.toLowerCase();

          // Transcript check — TRULY HARD constraint when input has NM_
          // If input specifies transcript, candidate MUST have matching transcript
          let transcriptOk = true;
          if (inputAllele.transcript) {
            transcriptOk = candidateAllele.transcript === inputAllele.transcript;
          }

          if (geneMatch && posMatch && refMatch && altMatch && transcriptOk) {
            // Full allele match — but 'exact' requires structured-field provenance
            if (alleleFromStructured) {
              matchType = 'exact';
              score = 100;
            } else {
              // Title-parsed allele: cap at 'partial' (precision-first)
              matchType = 'partial';
              score = 80; // Higher than other partials since allele does match
            }
          } else if (geneMatch && posMatch && refMatch && altMatch && !transcriptOk) {
            // Allele matches but transcript mismatch → partial
            matchType = 'partial';
            score = 60;
          } else if (geneMatch && posMatch) {
            matchType = 'partial';
            score = 40;
          } else if (geneMatch) {
            matchType = 'partial';
            score = 10;
          }
          // else: none (score 0)
        } else {
          // Parse failed — check title for gene at minimum
          if ((c.title || '').includes(gene)) {
            matchType = 'partial'; // NEVER exact from failed parse
            score = 5;
          }
          // else: none (score 0)
        }

        // Tie-break: stars ONLY applied when matchType is meaningful
        // Prevents unrelated expert-panel entries from ranking above actual matches
        const stars = getReviewStars(c.reviewStatus);
        if (matchType !== 'none') {
          score += stars * 0.1; // Stars are 0.1-0.4, never enough to jump a tier
        }

        return { ...c, score, matchType, parseSucceeded, alleleFromStructured, _raw: undefined };
    });

    // Sort by score desc
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    const best = scored[0];
    
    // If best score is 0, nothing matched meaningfully
    if (best.score === 0) {
      best.matchType = 'none';
    }
    
    // Provenance tracking for audit trail
    const provenance = best.alleleFromStructured ? 'structured' : (best.parseSucceeded ? 'title' : 'none');
    
    // Log selection for debugging/audit
    if (scored.length > 1) {
        const rejectionLog: Record<string, string[]> = {};
        scored.slice(1, 5).forEach(candidate => { // Log top 5 only
            const reasons: string[] = [];
            if (candidate.score < best.score) reasons.push(`Lower score (${candidate.score.toFixed(1)} vs ${best.score.toFixed(1)})`);
            if (!candidate.parseSucceeded) reasons.push('Allele parse failed');
            if (candidate.matchType !== best.matchType) reasons.push(`Worse match type (${candidate.matchType})`);
            rejectionLog[candidate.clinvarId] = reasons;
        });
        console.log(`[ClinVar] Allele-safe selection for ${gene} ${proteinChange}:`, JSON.stringify({
            selected: { id: best.clinvarId, score: best.score.toFixed(1), matchType: best.matchType, provenance, parsed: best.parseSucceeded },
            rejected: rejectionLog
        }, null, 2));
    }

    // Strip _raw before returning (not needed downstream)
    const { _raw, alleleFromStructured: _prov, ...cleanBest } = best;
    return cleanBest as ClinVarResult;
}

// Helper to extract protein part from potentially transcript-prefixed string
// e.g. "NM_004333.6:p.Val600Glu" -> "Val600Glu"
// e.g. "p.V600E" -> "V600E" 
function extractProteinPart(input: string): string | null {
  // Find the first protein-like token anywhere in the string
  // Handles: "...:p.Val600Glu", "p.V600E", "BRAF(p.Val600Glu)"
  // Matches: p. (optional) + 1/3 letters + digits + 1/3 letters or * or Ter
  const m = input.match(/(?:p\.)?([A-Za-z]{1,3})(\d+)([A-Za-z]{1,3}|\*|Ter)/);
  if (!m) return null;
  // Regex groups: 1=Ref, 2=Pos, 3=Alt
  return `${m[1]}${m[2]}${m[3]}`; 
}

/**
 * Parse input gene + proteinChange into canonical allele.
 */
function parseInputToAllele(gene: string, proteinChange: string): ParsedAllele | null {
  // Extract transcript if present
  let transcript: string | undefined;
  const transcriptMatch = proteinChange.match(/(NM_\d+(?:\.\d+)?)/);
  if (transcriptMatch) transcript = transcriptMatch[1];

  // Extract protein part robustly
  const proteinPart = extractProteinPart(proteinChange);
  if (!proteinPart) return null;

  const match = proteinPart.match(/([A-Za-z]+?)(\d+)([A-Za-z]+|\*|Ter)/);
  if (!match) return null;

  const [, rawRef, posStr, rawAlt] = match;
  const pos = parseInt(posStr, 10);
  if (isNaN(pos)) return null;

  // Normalize to 3-letter
  const ref = rawRef.length === 1 ? toThreeLetter(rawRef) : rawRef;
  const alt = rawAlt.length === 1 ? toThreeLetter(rawAlt) : rawAlt;

  return { gene, ref, pos, alt, transcript };
}

// ==========================================
// API LAYER (unchanged from original)
// ==========================================

/**
 * Search ClinVar for a variant
 */
async function searchClinVar(gene: string, proteinChange: string): Promise<any> {
  // Extract clean protein part (e.g. "Val600Glu") for search
  // This avoids searching for "NM_004333:p.Val600Glu" which fails
  const cleanChange = extractProteinPart(proteinChange);

  if (!cleanChange) {
      // Fallback: use original string if we can't parse it (unlikely to work but safe)
      console.warn(`[ClinVar] Could not extract protein part from: ${proteinChange}`);
  }
  
  const searchTerm = cleanChange || proteinChange;
  
  // Build search query
  // We search for: GENE AND (ProteinChange OR OriginalInput)
  // This covers specific syntax "p.Val600Glu" vs "Val600Glu"
  const query = encodeURIComponent(
    `${gene}[gene] AND (${searchTerm}[variant name] OR ${proteinChange}[variant name])`
  );
  
  // RETMAX 20 to catch strict matches that might be buried
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${query}&retmode=json&retmax=20`;
  
  console.log(`[ClinVar] Searching: ${gene} ${proteinChange}`);
  
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`ClinVar search failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch details for multiple ClinVar IDs in batch
 */
/**
 * Fetch details for multiple ClinVar IDs in batch
 */
async function fetchClinVarSummaryBatch(clinvarIds: string[]): Promise<FetchResult<ClinVarResult[]>> {
  const idsParam = clinvarIds.join(',');
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${idsParam}&retmode=json`;
  
  const result = await fetchWithRetry<any>(url, {
      circuitBreakerKey: 'clinvar',
      timeoutMs: 8000
  });

  if (result && 'unavailable' in result) {
      return result;
  }

  if (!result || !result.result) return [];

  const results: ClinVarResult[] = [];
  // Parsed result is in result.result
  const data = result; 

  for (const id of clinvarIds) {
    const item = data.result[id];
    if (item) {
        results.push(parseClinVarResult(id, item));
    }
  }
  
  return results;
}

function parseClinVarResult(id: string, result: any): ClinVarResult {
    return {
        clinicalSignificance: extractClinicalSignificance(result),
        reviewStatus: extractReviewStatus(result),
        clinvarId: id,
        conditions: extractConditions(result),
        lastUpdated: result.supporting_submissions?.last_evaluated || 'Unknown',
        submitterCount: result.supporting_submissions?.scv?.length || 0,
        title: result.title || '',
        matchType: 'none', // default — upgraded by pickBestClinVarEntry
        _raw: result,       // Pass raw esummary data for structured parsing
    };
}

// ==========================================
// EXTRACTORS (unchanged)
// ==========================================

function extractClinicalSignificance(result: any): string {
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

function extractReviewStatus(result: any): string {
  if (result.clinical_significance?.review_status) {
    return result.clinical_significance.review_status;
  }
  if (result.germline_classification?.review_status) {
    return result.germline_classification.review_status;
  }
  return 'no assertion provided';
}

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
  const status = (reviewStatus || '').toLowerCase();
  
  if (status.includes('practice guideline')) return 4;
  if (status.includes('expert panel')) return 4;
  if (status.includes('multiple submitters')) return 3;
  if (status.includes('single submitter')) return 2;
  if (status.includes('conflicting')) return 1;
  if (status.includes('no assertion criteria')) return 0;
  
  return 0;
}

/**
 * Get ClinVar URL for a variant
 */
export function getClinVarUrl(clinvarId: string): string {
  return `https://www.ncbi.nlm.nih.gov/clinvar/variation/${clinvarId}/`;
}

// Export parsing functions for testing
export { parseVariantFromTitle, parseInputToAllele, pickBestClinVarEntry, parseProteinHGVS };
