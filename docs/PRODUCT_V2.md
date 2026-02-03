# Product V2: Credibility & Adoption

## Purpose
Validate trust, robustness, and repeat usage through scientific rigor and educational integration.

## Core Hypothesis
V1 proved value. V2 proves credibility. Trust is the product.

## Key Shifts from V1→V2

| Dimension | V1 | V2 |
|-----------|-----|-----|
| Proof | Value exists | Credibility verified |
| Structures | AlphaFold only | PDB preferred, AlphaFold fallback |
| Claims | Agent suggests | Agent validated against experts |
| Distribution | Passive | Education-first active |
| Metrics | Time-to-insight | Export rate, citation, reuse |

## User Journeys

### Journey A: Student (Primary)
1. Professor shares case file link
2. Student loads variant in class
3. Exports case file for assignment
4. Submits with citation

### Journey B: Researcher
1. Validates known variant against database
2. Checks agent vs expert interpretation
3. Cites in methods: "Analysis performed using VariantLens-Open"
4. Shares case file in supplementary data

### Journey C: Contributor
1. Submits expert interpretation to validation set
2. Receives credit in VALIDATION.md
3. Builds reputation in community

## Anti-Goals (Explicitly Excluded)
- No pathogenicity scoring
- No diagnostic claims
- No GPU inference
- No patient data handling
- No drug discovery positioning

## Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Case file export rate | >40% | Server logs |
| Classroom adoptions | 5 courses | Outreach tracking |
| GitHub forks | 100 | GitHub API |
| Expert alignment score | >75% | Validation rubric |
| External citations | 3 mentions | Google Scholar alerts |

## Release Criteria
- [ ] Validation set live with 10+ variants
- [ ] PDB integration functional
- [ ] Distribution pack sent to 10 educators
- [ ] Case file schema documented
- [ ] Accessibility baseline (keyboard nav)
