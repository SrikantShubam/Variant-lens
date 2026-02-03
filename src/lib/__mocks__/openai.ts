export class OpenAI {
  chat = {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                hypothesis: "Test hypothesis",
                structural_basis: ["Test basis"],
                confidence: "high",
                reasoning_chain: ["Reason 1"],
                // For ContextAgent schema
                gene_function: "Test function",
                domain_context: "Test domain",
                known_annotations: ["Test annotation"],
                clinvar_summary: "Test clinvar",
                // For CriticAgent schema
                citations_validated: [],
                hallucination_flags: [],
                uncertainty_acknowledged: true,
                final_confidence: "high"
              })
            }
          }
        ],
        usage: { total_tokens: 100 }
      })
    }
  };

  constructor(apiKey?: object) {}
}

export default OpenAI;
