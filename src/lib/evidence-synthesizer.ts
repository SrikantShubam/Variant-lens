/**
 * EVIDENCE SYNTHESIZER AGENT
 * 
 * Replaces the old "MechanismAgent" with honest, grounded synthesis.
 * 
 * Key differences:
 * - NO mechanism inference
 * - NO confidence scores
 * - Summarizes KNOWNS from curated data
 * - Lists UNKNOWNS explicitly
 * - Uses restrained language
 */

import OpenAI from 'openai';
import { withRetry, getFallbackConfig } from './llm-config';
import { 
  CuratedProteinInfo, 
  EvidenceCoverage, 
  ExplicitUnknowns,
  RESEARCH_DISCLAIMER 
} from './types/honest-response';

// ==========================================
// SYSTEM PROMPT - HONEST AND RESTRAINED
// ==========================================

const EVIDENCE_SYNTHESIZER_PROMPT = `You are an evidence briefing assistant for genetic variant research.

YOUR ROLE:
- Summarize what is KNOWN about a variant from curated data
- Clearly state what is UNKNOWN or LIMITED
- Help researchers understand the evidence landscape

STRICT RULES (NEVER VIOLATE):
1. ONLY describe information present in the provided curated data
2. NEVER infer mechanism, pathogenicity, or clinical significance
3. NEVER claim to know contacts, distances, or 3D relationships unless explicitly provided
4. NEVER introduce new biological facts not in the input data
5. Use RESTRAINED language: "The data shows...", "According to UniProt...", "No information available..."
6. Keep summaries SHORT for low-evidence variants (1-2 sentences)
7. MUST mention at least one limitation in every summary
8. Start with: "Based on available data..." or similar qualifier

OUTPUT FORMAT (JSON):
{
  "summary": "Brief evidence summary. MUST mention at least one limitation.",
  "knownFacts": ["Fact 1 from data", "Fact 2 from data"],
  "limitations": ["What we cannot determine", "What data is missing"]
}`;

// ==========================================
// EVIDENCE SYNTHESIZER
// ==========================================

export interface EvidenceSynthesisResult {
  summary: string;
  knownFacts: string[];
  limitations: string[];
}

export async function synthesizeEvidence(
  variant: string,
  curatedInfo: CuratedProteinInfo,
  coverage: EvidenceCoverage,
  unknowns: ExplicitUnknowns
): Promise<EvidenceSynthesisResult> {
  
  // Build context from curated data ONLY
  const context = buildContext(variant, curatedInfo, coverage, unknowns);
  
  const messages = [
    { role: 'system', content: EVIDENCE_SYNTHESIZER_PROMPT },
    { role: 'user', content: context }
  ];

  try {
    const result = await callLLM(messages);
    return result;
  } catch (error) {
    // Fallback for API failures - be honest about it
    return {
      summary: `Evidence synthesis unavailable for ${variant} due to an API error. Please refer to the curated data below.`,
      knownFacts: buildKnownFacts(curatedInfo, coverage),
      limitations: unknowns.items,
    };
  }
}

// ==========================================
// BUILD CONTEXT FOR LLM
// ==========================================

function buildContext(
  variant: string,
  curatedInfo: CuratedProteinInfo,
  coverage: EvidenceCoverage,
  unknowns: ExplicitUnknowns
): string {
  return `
VARIANT: ${variant}

EVIDENCE UNKNOWNS (list these first in summary if critical):
${unknowns.items.map(u => `- ${u}`).join('\n')}

CURATED PROTEIN DATA (from UniProt):
- Gene: ${curatedInfo.gene}
- Protein: ${curatedInfo.proteinName}
- Protein Length: ${curatedInfo.proteinLength} amino acids
- Variant Position: ${curatedInfo.variantPosition}
- In Annotated Domain: ${curatedInfo.variantInDomain || 'No (outside known domains)'}
- Domains: ${curatedInfo.domains.length > 0 
  ? curatedInfo.domains.map(d => `${d.name} (${d.start}-${d.end})`).join(', ') 
  : 'None annotated'}
- Near Functional Site: ${curatedInfo.nearFunctionalSite ? 'Yes' : 'No'}

EVIDENCE COVERAGE:
- Structure: ${coverage.structure.status} ${coverage.structure.id ? `(${coverage.structure.source} ${coverage.structure.id})` : ''}
- Clinical Annotation: ${coverage.clinical.status}
- Literature: ${coverage.literature.variantSpecificCount} variant-specific papers

INSTRUCTIONS:
Based ONLY on the above data, write a brief evidence summary.
If many unknowns, keep summary very short (1-2 sentences).
If rich data, summarize key points (3-4 sentences max).
Never infer mechanism or pathogenicity.
`.trim();
}

// ==========================================
// BUILD KNOWN FACTS (FALLBACK)
// ==========================================

function buildKnownFacts(
  curatedInfo: CuratedProteinInfo, 
  coverage: EvidenceCoverage
): string[] {
  const facts: string[] = [];
  
  facts.push(`Gene: ${curatedInfo.gene}, Protein: ${curatedInfo.proteinName}`);
  facts.push(`Variant at position ${curatedInfo.variantPosition} of ${curatedInfo.proteinLength} amino acids`);
  
  if (curatedInfo.variantInDomain) {
    facts.push(`Located in ${curatedInfo.variantInDomain} domain`);
  }
  
  if (coverage.structure.status !== 'none') {
    facts.push(`Structure: ${coverage.structure.source} ${coverage.structure.id || ''} (${coverage.structure.status})`);
  }
  
  if (coverage.clinical.status !== 'none') {
    facts.push(`Clinical: ${coverage.clinical.status} (${coverage.clinical.source || 'unknown source'})`);
  }
  
  if (coverage.literature.variantSpecificCount > 0) {
    facts.push(`${coverage.literature.variantSpecificCount} variant-specific publications found`);
  }
  
  return facts;
}

// ==========================================
// LLM CALL (REUSED INFRASTRUCTURE)
// ==========================================

async function callLLM(messages: any[]): Promise<EvidenceSynthesisResult> {
  return withRetry(async (provider) => {
    console.log(`[EvidenceSynthesizer] Using provider: ${provider.name}`);

    if (provider.name === 'nvidia' || provider.name === 'openrouter') {
      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
        defaultHeaders: provider.name === 'openrouter' ? {
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'VariantLens',
        } : {},
      });

      const response = await client.chat.completions.create({
        model: provider.model || 'meta/llama-3.3-70b-instruct',
        messages,
        temperature: 0.1, // Low temperature for factual synthesis
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      
      try {
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw new Error('Failed to parse LLM response');
      }
    }
    
    throw new Error(`Unsupported provider: ${provider.name}`);
  }, getFallbackConfig());
}

// ==========================================
// FORMAT FINAL SUMMARY WITH DISCLAIMER
// ==========================================

export function formatSummaryWithDisclaimer(
  synthesis: EvidenceSynthesisResult,
  modelName: string
): { text: string; generatedBy: string; disclaimer: string } {
  return {
    text: synthesis.summary,
    generatedBy: modelName,
    disclaimer: RESEARCH_DISCLAIMER,
  };
}
