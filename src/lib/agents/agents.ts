import OpenAI from 'openai';
import { z } from 'zod';
import { withRetry, getFallbackConfig } from '../llm-config';

// Schemas
const ContextSchema = z.object({}).passthrough();
const HypothesisSchema = z.object({}).passthrough();
const CriticSchema = z.object({}).passthrough();

// Removed strict schemas for debugging

// Helper: Call LLM with Failover
async function generateWithFallback(
  messages: any[],
  temperature: number = 0.2
): Promise<any> {
  return withRetry(async (provider) => {
    console.log(`Using provider: ${provider.name} (${provider.model})`);

    if (provider.name === 'openrouter' || provider.name === 'nvidia') {
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
        temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content || '{}';
      console.log(`[DEBUG] Raw Response (${provider.name}):`, content.substring(0, 200) + '...');
      
      try {
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        throw e;
      }

    } else if (provider.name === 'gemini') {
      // Gemini REST API Fallback
      let systemInfo = '';
      const contents = [];
      
      for (const m of messages) {
        if (m.role === 'system') {
          systemInfo += m.content + '\n';
        } else {
          contents.push({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          });
        }
      }

      // Prepend system info to first user message
      if (systemInfo && contents.length > 0) {
        const firstUser = contents.find(c => c.role === 'user');
        if (firstUser) {
          firstUser.parts[0].text = `System: ${systemInfo}\n\n${firstUser.parts[0].text}`;
        }
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
      
      const generationConfig: any = {
        temperature,
      };

      // Only enable native JSON mode for Gemini (Gemma doesn't support it yet)
      if (provider.model && !provider.model.includes('gemma')) {
        generationConfig.responseMimeType = 'application/json';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`[DEBUG] Raw Response (${provider.name}):`, JSON.stringify(data).substring(0, 500) + '...');

      // Robust JSON Extraction for Chatty Models (Gemma/Llama)
      try {
        // 1. Try pure parse first (fast path)
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e) {
        // 2. Regex fallback: Find { ... } block
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (inner) {
            console.error(`[DEBUG] Regex JSON Parse Failed:`, jsonMatch[0].substring(0, 100));
            throw inner;
          }
        }
        console.error(`[DEBUG] No JSON found in response.`);
        throw e;
      }
    }
    
    throw new Error(`Unknown provider: ${provider.name}`);
  }, getFallbackConfig());
}

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

    const messages = [
      {
        role: 'system',
        content: 'You are a precise bioinformatics curator. Summarize biological context using only provided data. Never infer beyond evidence. Flag missing information.'
      },
      { role: 'user', content: prompt }
    ];

    try {
      const json = await generateWithFallback(messages, 0.1);
      return ContextSchema.parse(json);
    } catch (e) {
      console.log(`[DEBUG] ContextAgent Zod Error:`, e); 
      // Return safe fallback to allow pipeline to continue
      return {
        gene_function: 'Context analysis failed',
        domain_context: 'Unknown',
        known_annotations: [],
        clinvar_summary: null,
        confidence: 'low'
      };
    }
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

    const messages = [
      {
        role: 'system',
        content: 'You are a structural biologist explaining protein variants to graduate students. Be cautious, specific, and acknowledge uncertainty.'
      },
      { role: 'user', content: prompt }
    ];

    try {
      const json = await generateWithFallback(messages, 0.2);
      return HypothesisSchema.parse(json);
    } catch (e) {
      console.error('MechanismAgent failed:', e);
      return {
        hypothesis: 'Mechanism analysis unavailable due to API limits.',
        structural_basis: [],
        confidence: 'low',
        reasoning_chain: []
      };
    }
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

    const messages = [
      {
        role: 'system',
        content: 'You are a scientific integrity reviewer. Be strict about citations and uncertainty.'
      },
      { role: 'user', content: prompt }
    ];

    try {
      const json = await generateWithFallback(messages, 0.0);
      return CriticSchema.parse(json);
    } catch (e) {
      console.error('CriticAgent failed:', e);
      return {
        citations_validated: [],
        hallucination_flags: ['Review incomplete due to API failure'],
        uncertainty_acknowledged: true,
        final_confidence: 'low'
      };
    }
  }
}
