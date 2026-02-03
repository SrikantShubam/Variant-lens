import OpenAI from 'openai';
import { z } from 'zod';

// OpenRouter uses OpenAI-compatible API
export const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
    'X-Title': 'VariantLens',
  },
});

// Default model for OpenRouter
const DEFAULT_MODEL = 'google/gemini-flash-1.5:free';

// Schemas for structured output
const ContextSchema = z.object({
  gene_function: z.string().max(200),
  domain_context: z.string().max(200),
  known_annotations: z.array(z.string()),
  clinvar_summary: z.string().nullable(),
  confidence: z.enum(['high', 'moderate', 'low']),
});

const HypothesisSchema = z.object({
  hypothesis: z.string().max(300),
  structural_basis: z.array(z.string()),
  confidence: z.enum(['high', 'moderate', 'low', 'uncertain']),
  reasoning_chain: z.array(z.string()),
});

const CriticSchema = z.object({
  citations_validated: z.array(z.object({
    claim: z.string(),
    source: z.string(),
    valid: z.boolean(),
  })),
  hallucination_flags: z.array(z.string()),
  uncertainty_acknowledged: z.boolean(),
  final_confidence: z.enum(['high', 'moderate', 'low', 'uncertain']),
});

export class ContextAgent {
  async run(variant: string, uniprotData: any, clinvarData: any): Promise<z.infer<typeof ContextSchema>> {
    const prompt = `
Analyze this genetic variant and provide structured context:
Variant: ${variant}

UniProt Data: ${JSON.stringify(uniprotData, null, 2)}
ClinVar Data: ${JSON.stringify(clinvarData, null, 2)}

Provide JSON with:
- gene_function: 2-sentence summary of gene's role
- domain_context: Where in protein structure this variant falls
- known_annotations: Key functional annotations
- clinvar_summary: ClinVar interpretation if available
- confidence: Your confidence in this context assessment
`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a precise bioinformatics curator. Summarize biological context using only provided data. Never infer beyond evidence. Flag missing information.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    return ContextSchema.parse(JSON.parse(content));
  }
}

export class MechanismAgent {
  async run(
    variant: string, 
    context: any, 
    structureData: any,
    localEnvironment: any
  ): Promise<z.infer<typeof HypothesisSchema>> {
    const prompt = `
Explain the structural mechanism of this variant:

Variant: ${variant}
Context: ${JSON.stringify(context, null, 2)}
Structure: ${JSON.stringify(structureData, null, 2)}
Local Environment (residues within 8Å): ${JSON.stringify(localEnvironment, null, 2)}

Rules:
- Cite specific residues, distances, or structural features
- Use cautious language: "may disrupt", "could reduce", "suggests"
- If mechanism unclear, state: "Structural basis uncertain"
- Never assign pathogenicity or clinical significance

Provide JSON with hypothesis, structural_basis, confidence, and reasoning_chain.
`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a structural biologist explaining protein variants to graduate students. Be cautious, specific, and acknowledge uncertainty.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    return HypothesisSchema.parse(JSON.parse(content));
  }
}

export class CriticAgent {
  async review(
    hypothesis: any,
    citations: any[]
  ): Promise<z.infer<typeof CriticSchema>> {
    const prompt = `
Review this hypothesis for scientific integrity:

Hypothesis: ${JSON.stringify(hypothesis, null, 2)}
Available Citations: ${JSON.stringify(citations, null, 2)}

Check:
1. Are all factual claims supported by citations?
2. Is uncertainty clearly stated where evidence is indirect?
3. Is confidence level appropriate for evidence quality?

Flag any unsupported claims as "UNSUPPORTED: [claim]"
Downgrade confidence if key claims lack support.

Provide JSON with citations_validated, hallucination_flags, uncertainty_acknowledged, final_confidence.
`;

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a scientific integrity reviewer. Be strict about citations and uncertainty.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content || '{}';
    return CriticSchema.parse(JSON.parse(content));
  }
}
