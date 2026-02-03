import curatedSet from './curated_set.json';
import { AgentOrchestrator } from '../lib/agents';

export interface AlignmentResult {
  variant: string;
  agreement: 'full' | 'partial' | 'none' | 'error';
  mechanismAgreement: 'full' | 'partial' | 'none';
  confidenceCalibration: 'match' | 'over' | 'under';
  score: number; // 0-100
  notes: string[];
}

export function calculateAlignment(
  expert: { mechanism: string; confidence: string },
  agent: { mechanism: string; confidence: string }
): {
  mechanismAgreement: AlignmentResult['mechanismAgreement'];
  confidenceCalibration: AlignmentResult['confidenceCalibration'];
} {
  const expertLower = expert.mechanism.toLowerCase();
  const agentLower = agent.mechanism.toLowerCase();
  
  // Jaccard Similarity
  const expertTokens = tokenize(expertLower);
  const agentTokens = tokenize(agentLower);
  
  if (expertTokens.size === 0) return { mechanismAgreement: 'none', confidenceCalibration: 'match' }; // Should not happen with valid expert data
  
  const intersection = new Set([...expertTokens].filter(x => agentTokens.has(x)));
  const union = new Set([...expertTokens, ...agentTokens]);
  
  const jaccard = intersection.size / union.size;
  
  let mechanismAgreement: AlignmentResult['mechanismAgreement'] = 'none';
  if (jaccard > 0.5) mechanismAgreement = 'full';
  else if (jaccard > 0.2) mechanismAgreement = 'partial';

  // Compare confidence
  const confidenceLevels = { high: 3, moderate: 2, low: 1, uncertain: 0 };
  const expertConf = confidenceLevels[expert.confidence as keyof typeof confidenceLevels] ?? 0;
  const agentConf = confidenceLevels[agent.confidence as keyof typeof confidenceLevels] ?? 0;
  
  let confidenceCalibration: AlignmentResult['confidenceCalibration'] = 'match';
  if (agentConf > expertConf) confidenceCalibration = 'over';
  if (agentConf < expertConf) confidenceCalibration = 'under';

  return { mechanismAgreement, confidenceCalibration };
}

function tokenize(text: string): Set<string> {
  const stopwords = new Set(['the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'with', 'by']);
  const words = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").split(/\s+/);
  return new Set(words.filter(w => w.length > 2 && !stopwords.has(w)));
}

// Deprecated: extractKeyTerms
function extractKeyTerms(text: string): string[] {
   return []; 
}

export async function compareToExpert(hgvs: string): Promise<AlignmentResult> {
  const variantData = curatedSet.find(v => v.hgvs === hgvs);
  
  if (!variantData) {
    return {
      variant: hgvs,
      agreement: 'error',
      mechanismAgreement: 'none',
      confidenceCalibration: 'match',
      score: 0,
      notes: ['Variant not in curated set'],
    };
  }

  try {
    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.analyze(hgvs);
    
    // Compare
    const { mechanismAgreement, confidenceCalibration } = calculateAlignment(
      { 
        mechanism: variantData.expertHypothesis, 
        confidence: variantData.expertConfidence 
      },
      { 
        mechanism: result.hypothesis.text, 
        confidence: result.hypothesis.confidence 
      }
    );
    
    // Calculate overall score
    const confidenceLevels = { high: 3, moderate: 2, low: 1, uncertain: 0 };
    const expertConf = confidenceLevels[variantData.expertConfidence as keyof typeof confidenceLevels] ?? 0;

    let score = 0;
    if (mechanismAgreement === 'full') score += 60;
    if (mechanismAgreement === 'partial') score += 30;
    if (confidenceCalibration === 'match') score += 20;
    if (confidenceCalibration === 'under' && expertConf <= 2) score += 10; // Better to be cautious
    
    // Check for flags
    const notes: string[] = [];
    if (result.validation.flags.length > 0) {
      notes.push(`Flags: ${result.validation.flags.join(', ')}`);
    }
    
    // Determine overall agreement
    let agreement: AlignmentResult['agreement'] = 'none';
    if (score >= 70) agreement = 'full';
    else if (score >= 40) agreement = 'partial';
    
    return {
      variant: hgvs,
      agreement,
      mechanismAgreement,
      confidenceCalibration,
      score,
      notes,
    };
    
  } catch (error) {
    return {
      variant: hgvs,
      agreement: 'error',
      mechanismAgreement: 'none',
      confidenceCalibration: 'match',
      score: 0,
      notes: [`Error: ${(error as Error).message}`],
    };
  }
}

export async function runFullValidation(): Promise<{
  results: AlignmentResult[];
  summary: {
    total: number;
    full: number;
    partial: number;
    none: number;
    error: number;
    averageScore: number;
  };
}> {
  const results: AlignmentResult[] = [];
  
  for (const variant of curatedSet) {
    const result = await compareToExpert(variant.hgvs);
    results.push(result);
  }
  
  const summary = {
    total: results.length,
    full: results.filter(r => r.agreement === 'full').length,
    partial: results.filter(r => r.agreement === 'partial').length,
    none: results.filter(r => r.agreement === 'none').length,
    error: results.filter(r => r.agreement === 'error').length,
    averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
  };
  
  return { results, summary };
}
