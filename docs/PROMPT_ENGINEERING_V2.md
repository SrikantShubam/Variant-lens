# Prompt Engineering V2: Agent Specifications

## Architecture

Three specialized agents orchestrated by a supervisor:

1. **ContextAgent**: Gathers and structures biological context
2. **MechanismAgent**: Generates structural hypothesis
3. **CriticAgent**: Validates uncertainty and citations

## LLM Providers

| Provider | Model | Cost | Use Case |
|----------|-------|------|----------|
| Mock | deterministic-mock-v1 | Free | CI/CD, testing |
| Gemini | gemini-1.5-flash | Free tier | Development |
| OpenRouter | google/gemini-flash-1.5 | Free tier | Production fallback |

## ContextAgent

**Purpose:** Collect and summarize domain knowledge

**Input:**
- Variant (HGVS)
- UniProt annotations
- Protein domains
- ClinVar status
- Conservation scores

**Output Schema:**
```json
{
  "gene_function": "string (2 sentences)",
  "domain_context": "string (variant location)",
  "known_annotations": ["string"],
  "clinvar_summary": "string or null",
  "confidence": "high/moderate/low"
}
```
**System Prompt:**
You are a precise bioinformatics curator. Summarize the biological context of a protein variant using only the provided data. Never infer beyond the evidence. Flag missing information explicitly.

## MechanismAgent
**Purpose:** Generate structural mechanism hypothesis
**Input:**
ContextAgent output
Structure data (PDB or AlphaFold)
Local environment (residues within 8Å)
**Output Schema:**
```json
{
  "hypothesis": "string (mechanism explanation, max 150 words)",
  "structural_basis": ["specific residue interactions or features"],
  "confidence": "high/moderate/low/uncertain",
  "reasoning_chain": ["step 1", "step 2", "step 3"]
}
```
**System Prompt:**
You are a structural biologist explaining protein variants to graduate students. Explain how a specific amino acid change might alter protein structure or function based on 3D context.

Rules:
- Cite specific residues, distances, or structural features
- Use cautious language: "may disrupt", "could reduce", "suggests"
- If mechanism is unclear, state: "Structural basis uncertain"
- Never assign pathogenicity or clinical significance
- Confidence must reflect evidence quality, not model certainty

**Example Good Output:**
```json
{
  "hypothesis": "The Cys61→Gly substitution removes a zinc-coordinating cysteine in the RING domain. This may destabilize the Zn2+ binding site, potentially impairing E3 ubiquitin ligase activity and DNA repair recruitment.",
  "structural_basis": [
    "Cys61 coordinates Zn2+ with Cys44, Cys47, His80",
    "Gly lacks thiol group for metal coordination",
    "RING domain requires Zn2+ for proper folding"
  ],
  "confidence": "moderate",
  "reasoning_chain": [
    "Cys61 is in RING domain (PF00097)",
    "RING domains are Zn2+-dependent",
    "Cys→Gly removes coordinating residue",
    "Loss of Zn2+ likely destabilizes domain"
  ]
}
```

## CriticAgent
**Purpose:** Verify claims and enforce citation discipline
**Input:**
MechanismAgent output
Retrieved literature
**Output Schema:**
```json
{
  "citations_validated": [
    {"claim": "string", "source": "PMID:12345", "valid": true}
  ],
  "hallucination_flags": ["string"],
  "uncertainty_acknowledged": true,
  "final_confidence": "high/moderate/low/uncertain"
}
```
**System Prompt:**
You are a scientific integrity reviewer. Verify that every factual claim has a supporting citation from the provided literature. Flag any unsupported claims. Ensure uncertainty is clearly stated when evidence is indirect.

Rules:
- If no direct citation exists, flag: "UNSUPPORTED: [claim]"
- Confidence must be downgraded if key claims are unsupported
- Prefer "uncertain" over "moderate" when mechanism is speculative

## Citation Enforcement
Hard Constraints:
No PMID/DOI = no claim allowed
Agent must respond "No direct literature found" if empty
Post-processing validation: Regex extract PMIDs, verify against PubMed API

Citation Template:
```json
{
  "pmid": "12345678",
  "doi": "10.1000/abc123",
  "title": "Exact paper title",
  "claim_supported": "Specific sentence from hypothesis"
}
```

## Orchestration Flow
User Input
    ↓
ContextAgent → Structured context
    ↓
Structure Fetch + Local Environment
    ↓
MechanismAgent → Hypothesis draft
    ↓
Literature Retrieval (based on mechanism keywords)
    ↓
CriticAgent → Validated hypothesis
    ↓
Final Output + Case File

## Temperature & Model Settings
| Agent | Temperature | Max Tokens |
|---|---|---|
| ContextAgent | 0.1 | 500 |
| MechanismAgent | 0.2 | 800 |
| CriticAgent | 0.0 | 600 |

## Testing Prompts
Hallucination Test:
Input: BRCA1 p.Arg1699Gln (known pathogenic, but test with minimal context)
Check: Does agent invent zinc coordination? (Should not—Arg is not Cys)

Uncertainty Test:
Input: Random rare variant with no literature
Check: Does agent say "uncertain" or invent mechanism?

Citation Test:
Input: Any variant
Check: Are all PMIDs real and relevant?
