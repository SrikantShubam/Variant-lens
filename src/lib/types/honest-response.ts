/**
 * HONEST RESPONSE TYPES
 * 
 * Types for the pivoted evidence briefing system.
 * No fake precision, no over-claiming.
 * 
 * These replace the old "hypothesis" and "confidence" types.
 */

// ==========================================
// CURATED PROTEIN INFO
// Extracted from UniProt, not raw JSON dump
// ==========================================
export interface CuratedProteinInfo {
  gene: string;
  uniprotId: string;
  proteinName: string;
  proteinLength: number;
  
  // Domains - only those explicitly annotated in UniProt
  domains: Array<{
    name: string;
    start: number;
    end: number;
    description?: string;
  }>;
  
  // Functional sites - NOT "activeResidues"
  // Only sites explicitly typed in UniProt features
  functionalSites: Array<{
    type: 'active_site' | 'binding_site' | 'metal_binding' | 'disulfide_bond';
    residue: number;
    description?: string;
  }>;
  
  // Variant-specific context
  variantPosition: number;
  variantInDomain: string | null; // Domain name or null
  nearFunctionalSite: boolean;
  distanceToNearestSite: number | null; // In sequence, not 3D
}

// ==========================================
// EVIDENCE COVERAGE
// Replaces fake "certainty %" with honest indicators
// ==========================================
export interface EvidenceCoverage {
  // Structure availability
  structure: {
    status: 'experimental' | 'predicted' | 'none' | 'unavailable';
    reason?: string; // For unavailable status
    source?: 'PDB' | 'AlphaFold';
    id?: string;
    resolution?: number;
    paeUrl?: string; // Phase-4
    note?: string; 
    sifts?: {
       mapped: boolean;
       pdbId: string;
       chain: string;
       pdbResidue: string;
       source: string;
    };
    availableStructures?: Array<{
       id: string;
       source: string;
       url?: string; // Phase-4: API-provided structure URL
       resolution?: number;
       paeUrl?: string; // Phase-4
       chain: string;
       mapped: boolean;
       pdbResidue?: string; // Phase-4: Required for highlighting
    }>;
  };
  
  // Clinical annotation status (Phase-2: ClinVar integration)
  clinical: {
    status: 'pathogenic' | 'likely_pathogenic' | 'uncertain' | 'likely_benign' | 'benign' | 'none' | 'unavailable';
    reason?: string; // For unavailable status
    source?: 'ClinVar' | 'HGMD';
    significance?: string;      // Raw ClinVar text
    reviewStatus?: string;      // ClinVar review status
    stars?: number;             // 0-4 stars
    clinvarId?: string;         // For linking
    url?: string;               // Direct ClinVar URL
    conditions?: string[];      // Associated conditions
  };
  
  // Domain annotation
  domain: {
    inAnnotatedDomain: boolean;
    domainName?: string;
  };
  
  // Literature
  literature: {
    variantSpecificCount: number;
    unavailable?: boolean; // For unavailable status
    reason?: string;       // For unavailable status
    query?: string;         // Search transparency
    papers?: Array<{        // Top 5 snippets
      title: string;
      url: string;
      source: string;
      year: string;
    }>;
    note?: string; 
  };
}

// ==========================================
// EXPLICIT UNKNOWNS
// Must be populated before AI summary
// ==========================================
export interface ExplicitUnknowns {
  items: string[];
  severity: 'critical' | 'moderate' | 'minor';
}

// Pre-defined unknown messages for consistency
export const UNKNOWN_MESSAGES = {
  NO_STRUCTURE: 'No experimental or predicted structure available',
  NO_CLINICAL: 'No clinical significance annotation in ClinVar',
  OUTSIDE_DOMAIN: 'Variant position is outside annotated protein domains',
  NO_LITERATURE: 'No variant-specific literature found',
  LARGE_PROTEIN: 'Protein too large for complete structural coverage',
  UNRESOLVED_REGION: 'Variant falls in unresolved region of available structures',
  NO_FUNCTIONAL_SITE: 'No annotated functional sites near variant',
  MAPPING_NOT_COMPUTED: 'Structure residue mapping not yet computed',
} as const;

// ==========================================
// HONEST RESPONSE
// Full API response structure
// ==========================================
export interface HonestAPIResponse {
  // Input echo
  variant: {
    hgvs: string;          // Main display string (usually requested input)
    originalHgvs?: string; // Explicit requested input
    normalizedHgvs?: string; // Canonical form (Gene:p.RefPosAlt)
    transcript?: string;   // Transcript if detected
    gene: string;
    residue: number;
    isValidPosition: boolean;
  };

  // Evidence indicators (NO percentages)
  coverage: EvidenceCoverage;
  
  // UNKNOWNS FIRST (before any AI text)
  unknowns: ExplicitUnknowns;
  
  // Curated context
  curatedInfo: CuratedProteinInfo;
  
  // Metadata
  timestamp: string;
  processingMs: number;
}

export interface HonestReportData {
  variant: {
    hgvs: string;
    originalHgvs?: string;
    normalizedHgvs?: string;
    transcript?: string;
    gene: string;
    residue: number;
  };
  coverage: EvidenceCoverage;
  unknowns: ExplicitUnknowns;
  curatedInfo: CuratedProteinInfo;
  timestamp?: string; // Optional for view
}

// ==========================================
// VALIDATION ERROR
// For invalid variants (position > length, etc.)
// ==========================================
export interface VariantValidationError {
  error: true;
  code: 'INVALID_POSITION' | 'UNKNOWN_GENE' | 'PARSE_ERROR' | 'DATA_UNAVAILABLE';
  message: string;
  details?: {
    providedPosition?: number;
    proteinLength?: number;
    gene?: string;
  };
}

// ==========================================
// DISCLAIMER (always shown)
// ==========================================
export const RESEARCH_DISCLAIMER = `
⚠️ RESEARCH USE ONLY

This tool summarizes available evidence about genetic variants.
It does NOT provide:
- Clinical interpretation
- Pathogenicity scoring  
- Diagnostic guidance
- Treatment recommendations

Always consult qualified professionals for clinical decisions.
`.trim();
