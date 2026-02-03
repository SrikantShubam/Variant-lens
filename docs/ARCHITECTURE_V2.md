# Architecture V2: Resilient & Observable

## Principles
1. Zero GPU, zero Redis, zero background jobs (V2 batch cap: 20 variants)
2. Graceful degradation over failure
3. CDN-first assets
4. Stateless except for capped caching

## Component Diagram

[User] → [Next.js Frontend] → [API Routes]
                          ↓
              ┌───────────┼───────────┐
              ↓           ↓           ↓
        [UniProt]   [PDB API]   [PubMed]
        (cached)    (cached)    (rate-limited)
              ↓           ↓
        [AlphaFold DB fallback]
              ↓
        [Agent Orchestrator]
              ↓
        [Case File Generator]
              ↓
        [Export: JSON + MD]

## Resilience Patterns

### Rate Limiting (Per-IP)
- /api/variant: 10 req/min
- /api/batch: 2 req/hour (capped at 20 variants)
- /api/validate: 5 req/min

### Caching Strategy (In-Memory, 1hr TTL)
- UniProt sequence lookups
- PDB metadata
- AlphaFold pLDDT scores

### Degradation Cascade

| Service | Failure Mode | Fallback |
|---------|--------------|----------|
| PDB | Timeout/unavailable | AlphaFold DB |
| AlphaFold DB | Timeout | Text-only report + retry |
| PubMed | Rate limit | "Evidence unavailable" |
| Agent | Timeout | Static template + warning |

## Structure Resolution Hierarchy

1. Query PDB for experimental structures matching UniProt ID + residue range
2. Filter: Resolution < 3.5Å, coverage > 80%
3. If none: Query AlphaFold DB
4. If partial: Flag "Limited structural context"
5. UI Badge: "PDB (Experimental)" | "AlphaFold (Predicted)" | "Partial Coverage"

## Batch Processing (Soft Launch)
IF variants.length > 1 AND <= 20:
Spawn background job (Next.js experimental)
Return job ID
Poll endpoint for status
Timeout: 5 minutes
Export: Combined case file + summary table
ELSE IF > 20:
Reject with: "Batch limit exceeded. Use API or split request."

## CDN & Performance

- Mol* via jsDelivr or unpkg
- Lazy load viewer (intersection observer)
- Mobile fallback: Static PNG of structure (Mol* headless render)
- Bundle size budget: <200KB initial JS

## Monitoring

- Failures logged to stdout (serverless-compatible)
- No persistent error DB (V2)
- Weekly: Review FAILURE_MODES.md, update patterns

## File Outputs

### case.json (Machine)
```json
{
  "variantlens_version": "2.0.0",
  "variant": "BRCA1 p.Cys61Gly",
  "timestamp": "2024-01-15T10:30:00Z",
  "structure": {
    "source": "PDB",
    "id": "1JNX",
    "resolution": 2.5,
    "coverage": "95%"
  },
  "agent_hypothesis": {
    "text": "...",
    "confidence": "moderate",
    "citations": ["PMID:12345"]
  },
  "validation": {
    "in_set": true,
    "expert_agreement": "partial"
  }
}
```
report.md (Human)
Executive summary
Structural context
Mechanism hypothesis
Evidence card
Citations
Validation note (if in curated set)
Export metadata
