export const openRouterFixtures = {
  // Toggle error scenarios for testing
  errors: {
    geminiRateLimit: false,
    llamaTimeout: false,
    mistralOverload: false,
  },

  // Model-specific responses
  responses: {
    // Gemini Flash (primary)
    'google/gemini-flash-1.5:free': {
      id: 'gen-123',
      model: 'google/gemini-flash-1.5:free',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              gene_function: 'BRCA1 is a tumor suppressor gene involved in DNA repair through homologous recombination. It encodes an E3 ubiquitin ligase that coordinates the cellular response to DNA damage.',
              domain_context: 'The variant is located in the N-terminal RING domain (amino acids 1-109), which is responsible for zinc coordination and E3 ubiquitin ligase activity.',
              known_annotations: ['E3 ubiquitin-protein ligase', 'DNA repair', 'Zinc-binding'],
              clinvar_summary: 'Pathogenic variant associated with breast and ovarian cancer predisposition',
              confidence: 'high',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 450, completion_tokens: 180, total_tokens: 630 },
    },

    // Llama 3.1 8B (fallback 1)
    'meta-llama/llama-3.1-8b-instruct:free': {
      id: 'gen-456',
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              gene_function: 'BRCA1 functions in DNA damage response and repair. It is a tumor suppressor.',
              domain_context: 'Variant located in RING domain, important for protein function.',
              known_annotations: ['DNA repair', 'Tumor suppressor'],
              clinvar_summary: 'Pathogenic',
              confidence: 'moderate',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 450, completion_tokens: 120, total_tokens: 570 },
    },

    // Mistral 7B (fallback 2)
    'mistralai/mistral-7b-instruct:free': {
      id: 'gen-789',
      model: 'mistralai/mistral-7b-instruct:free',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              gene_function: 'BRCA1 is involved in DNA repair mechanisms.',
              domain_context: 'RING domain region.',
              known_annotations: ['DNA repair'],
              clinvar_summary: null,
              confidence: 'low',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 450, completion_tokens: 80, total_tokens: 530 },
    },

    // Default/mechanism agent response
    default: {
      id: 'gen-default',
      model: 'mock-model',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              hypothesis: 'The Cys61→Gly substitution removes a zinc-coordinating cysteine in the RING domain. This may destabilize the Zn2+ binding site, potentially impairing E3 ubiquitin ligase activity and DNA repair recruitment.',
              structural_basis: [
                'Cys61 coordinates Zn2+ with Cys44, Cys47, His80',
                'Gly lacks thiol group for metal coordination',
                'RING domain requires Zn2+ for proper folding',
              ],
              confidence: 'moderate',
              reasoning_chain: [
                'Cys61 is in RING domain',
                'RING domains are Zn2+-dependent',
                'Cys→Gly removes coordinating residue',
                'Loss of Zn2+ likely destabilizes domain',
              ],
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 800, completion_tokens: 200, total_tokens: 1000 },
    },

    // Critic agent response
    critic: {
      id: 'gen-critic',
      model: 'mock-critic',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              citations_validated: [
                { claim: 'Cys61 coordinates Zn2+', source: 'PMID:19117993', valid: true },
                { claim: 'RING domain requires Zn2+', source: 'PMID:21952604', valid: true },
              ],
              hallucination_flags: [],
              uncertainty_acknowledged: true,
              final_confidence: 'moderate',
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 600, completion_tokens: 150, total_tokens: 750 },
    },

    // Overconfident (for testing critic)
    overconfident: {
      id: 'gen-bad',
      model: 'mock-overconfident',
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              hypothesis: 'This variant definitely causes cancer by destroying all protein function.',
              structural_basis: ['It breaks the protein completely'],
              confidence: 'high',
              reasoning_chain: ['Variant bad', 'Protein broken'],
            }),
          },
          finish_reason: 'stop',
        },
      ],
    },
  },
};
