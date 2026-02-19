// Force Node.js runtime for Circuit Breaker support
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { parseHGVS, normalizeVariant } from '@/lib/variant';
import { resolveStructure } from '@/lib/structure';
import { variantRateLimiter } from '@/lib/rate-limit';
import { 
  curateUniprotData, 
  validateVariantPosition,
  buildEvidenceCoverage,
  generateUnknowns,
  UniProtUnavailableError
} from '@/lib/uniprot-curator';
import { HonestAPIResponse, RESEARCH_DISCLAIMER } from '@/lib/types/honest-response';
import { getClinVarData, getClinVarUrl, getReviewStars } from '@/lib/clinvar-client';
import { searchPubMed } from '@/lib/pubmed-client';
import { getSiftsMapping } from '@/lib/sifts-client';
import { generateMarkdown } from '@/lib/report-utils';
import { logAuditEntry } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let gene = 'unknown';
  let residueNumber = 0;
  let normalizedInput = '';
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    // Rate limiting
    const allowed = await variantRateLimiter.check(ip);
    
    if (!allowed) {
      const retryAfter = variantRateLimiter.getRetryAfter(ip);
      logAuditEntry({
        hgvs: 'unknown', gene: 'unknown', residue: 0, ip,
        status: 'rate_limited', processingMs: Date.now() - startTime,
        evidenceSources: { clinvar: false, structure: false, literature: false },
      });
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
      normalizedInput = normalizedVariant.normalized;
      gene = normalizedVariant.parsed.gene;
      residueNumber = normalizedVariant.parsed.pos;
    } catch (error) {
      return NextResponse.json(
        { error: `Invalid HGVS: ${(error as Error).message}` },
        { status: 400 }
      );
    }

    // ==========================================
    // STEP 1: CURATE UNIPROT DATA (CORE)
    // ==========================================
    let curatedInfo;
    try {
      curatedInfo = await curateUniprotData(gene, residueNumber);
    } catch (error) {
      const message = (error as Error).message;
      
      // Position validation failed
      if (message.includes('exceeds') || message.includes('invalid')) {
        return NextResponse.json({
          error: true,
          code: 'INVALID_POSITION',
          message,
          details: { gene, providedPosition: residueNumber },
        }, { status: 400 });
      }
      
      // Gene not found / UniProt Unavailable
      if (error instanceof UniProtUnavailableError) {
          console.error(`[HonestAPI] Core data unavailable: ${gene}`);
           // Graceful degradation for CORE failure
           // We explicitly return a 200 OK with specific error shape as requested
           return NextResponse.json({
               variant: { hgvs: normalizedInput, gene, residue: residueNumber, isValidPosition: true },
               coreData: { 
                   unavailable: true, 
                   reason: 'Core protein data service (UniProt) is unavailable.', 
                   service: 'uniprot' 
               },
               coverage: {
                   structure: { status: 'unavailable', reason: 'Core data missing' },
                   clinical: { status: 'unavailable', reason: 'Core data missing' },
                   domain: { inAnnotatedDomain: false },
                   literature: { variantSpecificCount: 0, unavailable: true, reason: 'Core data missing' }
               },
               unknowns: { items: ['Core data unavailable (UniProt)'], severity: 'critical' },
               timestamp: new Date().toISOString(),
               processingMs: Date.now() - startTime,
           });
      }

      if (message.includes('resolve') || message.includes('Could not fetch')) {
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
    let enrichedAvailableStructures: any[] = [];
    let availableStructures: any[] = [];
    
    // Explicitly handle type for structure result to check for availability
    // Note: resolveStructure currently returns specific object, not FetchResult.
    // Ideally resolveStructure should also be robust, but it uses fetch locally or internal logic?
    // Looking at imports: resolveStructure is from '@/lib/structure'.
    // We assume resolveStructure logic might fail gracefully or return null.
    // For P1, if we didn't refactor resolveStructure to use fetchWithRetry yet, we wrap it.
    
    try {
      const result = await resolveStructure(gene, residueNumber);
      structureData = result.best;
      availableStructures = result.available || [];

      // Enrich structures with SIFTS (now resilient)
      if (curatedInfo.uniprotId && availableStructures.length > 0) {
           enrichedAvailableStructures = await Promise.all(
              availableStructures.map(async (s) => {
                  let chain = 'A';
                  let mapped = s.mapped ?? false;
                  let pdbResidue: string | undefined = undefined;

                  if (s.source === 'PDB') {
                      const sifts = await getSiftsMapping(curatedInfo.uniprotId, residueNumber, s.id);
                      
                      // Handle Resilient SIFTS Response
                      if (sifts && 'unavailable' in sifts) {
                          // partial failure of SIFTS for this structure
                          // Treat as unmapped/unknown
                          console.warn(`[HonestAPI] SIFTS unavailable for ${s.id}`);
                          mapped = false; 
                      } else if (sifts) {
                          chain = sifts.chain;
                          mapped = sifts.mapped;
                          pdbResidue = sifts.pdbResidue;
                      } else {
                          mapped = false;
                      }
                  } else if (s.source === 'AlphaFold') {
                      chain = 'A';
                      mapped = true;
                      pdbResidue = String(residueNumber);
                  }

                  return {
                      id: s.id,
                      source: s.source,
                      url: s.url,
                      resolution: s.resolution,
                      paeUrl: s.paeUrl,
                      chain,
                      mapped,
                      pdbResidue
                  };
              })
           );
      }
    } catch (error) {
       console.log(`[HonestAPI] Structure resolution failed:`, (error as Error).message);
    }

    // ==========================================
    // STEP 3: FETCH CLINVAR (Resilient)
    // ==========================================
    const proteinChange = `p.${normalizedVariant.parsed.ref}${normalizedVariant.parsed.pos}${normalizedVariant.parsed.alt}`;
    let clinvarData = null;
    
    // getClinVarData now returns FetchResult<ClinVarResult>
    const clinvarResult = await getClinVarData(gene, proteinChange);
    
    // Prepare data for coverage builder (handling unavailable state)
    // If unavailable, pass the failure object directly (buildEvidenceCoverage handles it)
    // If null, pass null.
    // If success, pass success.
    
    const clinvarForBuilder = clinvarResult; 
    
    if (clinvarResult && !('unavailable' in clinvarResult)) {
        // Success case - log it
        console.log(`[HonestAPI] ClinVar found: ${clinvarResult.clinicalSignificance}`);
        clinvarData = clinvarResult;
    } else if (clinvarResult && 'unavailable' in clinvarResult) {
        console.log(`[HonestAPI] ClinVar unavailable: ${clinvarResult.reason}`);
    } else {
        console.log(`[HonestAPI] No ClinVar entry for ${gene}:${proteinChange}`);
    }

    // ==========================================
    // STEP 4: FETCH LITERATURE (Resilient)
    // ==========================================
    let pubmedData = null;
    const pubmedResult = await searchPubMed(gene, proteinChange);
    const pubmedForBuilder = pubmedResult;

    if (pubmedResult && !('unavailable' in pubmedResult)) {
         if (pubmedResult.count > 0) {
             console.log(`[HonestAPI] PubMed found: ${pubmedResult.count} papers`);
         }
         pubmedData = pubmedResult;
    } else if (pubmedResult && 'unavailable' in pubmedResult) {
         const reason =
           'reason' in pubmedResult ? String(pubmedResult.reason) : 'unknown';
         console.log(`[HonestAPI] PubMed unavailable: ${reason}`);
    }

    // ==========================================
    // STEP 5: BUILD EVIDENCE COVERAGE
    // ==========================================
    
    // Refine structure data for builder:
    // We already enriched it. If `resolveStructure` failed entirely it's null.
    // We didn't add "Unavailable" state to `resolveStructure` yet (it wasn't in list of clients to refactor in P1, explicitly).
    // So we assume structure is "none" if it failed, unless we want to manually wrap it.
    // For now, passing `structureData` (enriched) is fine.
    
    // We need to re-assemble structure object for builder with enriched structures
    // structureData comes from resolveStructure().best, which does NOT have availableStructures.
    // We must inject it here.
    let structureForBuilder = structureData ? {
        ...structureData,
        sifts: (() => {
          const matched = (enrichedAvailableStructures.length > 0 ? enrichedAvailableStructures : availableStructures)
            .find((s: any) => s.id === structureData?.id && s.source === structureData?.source);
          if (!matched) return null;
          return {
            mapped: !!matched.mapped && !!matched.pdbResidue,
            pdbId: matched.id,
            chain: matched.chain || 'A',
            pdbResidue: matched.pdbResidue || '?',
            source: matched.source === 'PDB' ? 'PDBe-KB' : 'AlphaFold sequence index'
          };
        })(),
        availableStructures: enrichedAvailableStructures.length > 0 ? enrichedAvailableStructures : availableStructures
    } : null;

    // Prepare ClinVar data for builder
    let clinvarBuilderData = null;
    if (clinvarData) {
        clinvarBuilderData = {
           significance: clinvarData.clinicalSignificance,
           reviewStatus: clinvarData.reviewStatus,
           stars: getReviewStars(clinvarData.reviewStatus),
           clinvarId: clinvarData.clinvarId,
           url: getClinVarUrl(clinvarData.clinvarId),
           conditions: clinvarData.conditions
        };
    } else if (clinvarResult && 'unavailable' in clinvarResult) {
        clinvarBuilderData = { unavailable: true as const, reason: clinvarResult.reason };
    }

    const coverage = await buildEvidenceCoverage(
      curatedInfo,
      structureForBuilder,
      clinvarBuilderData,
      pubmedForBuilder   // Can be success | failure | null
    );

    // ==========================================
    // STEP 6: GENERATE EXPLICIT UNKNOWNS
    // ==========================================
    const unknowns = generateUnknowns(curatedInfo, coverage);

    // ==========================================
    // STEP 7: BUILD RESPONSE
    // ==========================================
    const response: HonestAPIResponse = {
      variant: {
        hgvs: normalizedInput,
        originalHgvs: hgvs,
        normalizedHgvs: normalizedInput,
        transcript: normalizedVariant.parsed.transcript,
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

    // Audit log
    logAuditEntry({
      hgvs: normalizedInput,
      gene,
      residue: residueNumber,
      ip,
      status: 'success', // It is a success 200, even if data is partial
      processingMs: Date.now() - startTime,
      evidenceSources: {
        clinvar: !!clinvarData,
        structure: !!structureData,
        literature: !!(pubmedData && pubmedData.count > 0),
      },
    });

    // Handle Markdown Format
    let format = 'json';
    try {
        const url = new URL(request.url);
        format = url.searchParams.get('format') || 'json';
    } catch {}

    if (format === 'md' || format === 'markdown') {
       const md = generateMarkdown(response);
       return new NextResponse(md, {
         status: 200,
         headers: { 'Content-Type': 'text/markdown' }
       });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[HonestAPI] Error:', error);
    logAuditEntry({
      hgvs: 'unknown', gene, residue: residueNumber, ip: ip,
      status: 'error', processingMs: Date.now() - startTime,
      evidenceSources: { clinvar: false, structure: false, literature: false },
      errorCode: (error as Error).message,
    });
    return NextResponse.json(
      { error: 'Internal server error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Keep old endpoint for backward compatibility
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'VariantLens API - Honest MVP',
    version: '2.0.0-pivot',
    disclaimer: RESEARCH_DISCLAIMER,
    usage: 'POST /api/variant with { "hgvs": "GENE:p.XnnnY" }',
  });
}
