/**
 * VARIANT API ROUTE - HONEST MVP
 * 
 * Pivoted from "interpretation engine" to "evidence briefing tool".
 * Key changes:
 * - Uses CuratedProteinInfo instead of raw JSON
 * - Returns EvidenceCoverage instead of fake confidence
 * - Shows ExplicitUnknowns BEFORE AI summary
 * - Validates variant position before processing
 * - Always includes research disclaimer
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseHGVS, normalizeVariant } from '@/lib/variant';
import { resolveStructure } from '@/lib/structure';
import { variantRateLimiter } from '@/lib/rate-limit';
import { 
  curateUniprotData, 
  validateVariantPosition,
  buildEvidenceCoverage,
  generateUnknowns 
} from '@/lib/uniprot-curator';
import { HonestAPIResponse, RESEARCH_DISCLAIMER } from '@/lib/types/honest-response';
import { getClinVarData, getClinVarUrl, getReviewStars } from '@/lib/clinvar-client';
import { searchPubMed } from '@/lib/pubmed-client';
import { getSiftsMapping } from '@/lib/sifts-client';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const allowed = await variantRateLimiter.check(ip);
    
    if (!allowed) {
      const retryAfter = variantRateLimiter.getRetryAfter(ip);
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // Parse request
    const body = await request.json();
    const { hgvs } = body;

    if (!hgvs) {
      return NextResponse.json(
        { error: 'Missing required field: hgvs' },
        { status: 400 }
      );
    }

    // Validate HGVS format
    let normalizedVariant;
    try {
      normalizedVariant = normalizeVariant(hgvs);
    } catch (error) {
      return NextResponse.json(
        { error: `Invalid HGVS: ${(error as Error).message}` },
        { status: 400 }
      );
    }

    const gene = normalizedVariant.parsed.gene;
    const residueNumber = normalizedVariant.parsed.pos;

    // ==========================================
    // STEP 1: CURATE UNIPROT DATA
    // ==========================================
    let curatedInfo;
    try {
      curatedInfo = await curateUniprotData(gene, residueNumber);
    } catch (error) {
      const message = (error as Error).message;
      
      // Check if position validation failed
      if (message.includes('exceeds') || message.includes('invalid')) {
        return NextResponse.json({
          error: true,
          code: 'INVALID_POSITION',
          message,
          details: { gene, providedPosition: residueNumber },
        }, { status: 400 });
      }
      
      // Gene not found
      if (message.includes('resolve')) {
        return NextResponse.json({
          error: true,
          code: 'UNKNOWN_GENE',
          message: `Could not resolve gene "${gene}" to UniProt`,
        }, { status: 404 });
      }
      
      throw error;
    }

    // ==========================================
    // STEP 2: RESOLVE STRUCTURE
    // ==========================================
    let structureData = null;
    try {
      structureData = await resolveStructure(gene, residueNumber);
    } catch (error) {
      console.log(`[HonestAPI] Structure resolution failed:`, (error as Error).message);
      // Don't fail - structure is optional
    }

    // ==========================================
    // STEP 2.5: FETCH CLINVAR DATA (Phase-2 Priority 1)
    // ==========================================
    const proteinChange = `p.${normalizedVariant.parsed.ref}${normalizedVariant.parsed.pos}${normalizedVariant.parsed.alt}`;
    let clinvarData = null;
    try {
      clinvarData = await getClinVarData(gene, proteinChange);
      if (clinvarData) {
        console.log(`[HonestAPI] ClinVar found: ${clinvarData.clinicalSignificance}`);
      } else {
        console.log(`[HonestAPI] No ClinVar entry for ${gene}:${proteinChange}`);
      }
    } catch (error) {
      console.log(`[HonestAPI] ClinVar fetch failed:`, (error as Error).message);
      // Don't fail - ClinVar is optional
    }

    // ==========================================
    // STEP 2.6: FETCH LITERATURE (Phase-2 Priority 2)
    // ==========================================
    let pubmedData = null;
    try {
      pubmedData = await searchPubMed(gene, proteinChange);
      if (pubmedData) {
        console.log(`[HonestAPI] PubMed found: ${pubmedData.count} papers`);
      }
    } catch (error) {
      console.log(`[HonestAPI] PubMed search failed:`, (error as Error).message);
    }

    // ==========================================
    // STEP 2.7: SIFTS MAPPING (Phase-2 Priority 3)
    // ==========================================
    let siftsData = null;
    if (structureData && structureData.source === 'PDB' && curatedInfo.uniprotId) {
      try {
        siftsData = await getSiftsMapping(curatedInfo.uniprotId, residueNumber, structureData.id);
        if (siftsData) {
           console.log(`[HonestAPI] SIFTS mapped: Chain ${siftsData.chain}, Residue ${siftsData.pdbResidue}`);
        } else {
           console.log(`[HonestAPI] SIFTS mapping failed for ${structureData.id}`);
        }
      } catch (error) {
        console.log(`[HonestAPI] SIFTS error:`, (error as Error).message);
      }
    }

    // ==========================================
    // STEP 3: BUILD EVIDENCE COVERAGE
    // ==========================================
    const coverage = await buildEvidenceCoverage(
      curatedInfo,
      structureData ? {
        source: structureData.source,
        id: structureData.id,
        resolution: structureData.resolution,
        sifts: siftsData // Pass SIFTS data
      } : null,
      clinvarData ? {
        significance: clinvarData.clinicalSignificance,
        reviewStatus: clinvarData.reviewStatus,
        stars: getReviewStars(clinvarData.reviewStatus),
        clinvarId: clinvarData.clinvarId,
        url: getClinVarUrl(clinvarData.clinvarId),
        conditions: clinvarData.conditions,
      } : null,
      pubmedData // Pass full object, not just count
    );

    // ==========================================
    // STEP 4: GENERATE EXPLICIT UNKNOWNS
    // ==========================================
    const unknowns = generateUnknowns(curatedInfo, coverage);

    // ==========================================
    // STEP 6: BUILD HONEST RESPONSE
    // ==========================================
    const response: HonestAPIResponse = {
      variant: {
        hgvs: normalizedVariant.normalized,
        gene: curatedInfo.gene,
        residue: residueNumber,
        isValidPosition: true,
      },
      coverage,
      unknowns,
      curatedInfo,
      timestamp: new Date().toISOString(),
      processingMs: Date.now() - startTime,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[HonestAPI] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Keep old endpoint for backward compatibility during transition
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'VariantLens API - Honest MVP',
    version: '2.0.0-pivot',
    disclaimer: RESEARCH_DISCLAIMER,
    usage: 'POST /api/variant with { "hgvs": "GENE:p.XnnnY" }',
  });
}
