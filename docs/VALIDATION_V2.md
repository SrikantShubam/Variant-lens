# Validation V2: Blinded Expert Alignment

## Purpose
Demonstrate agent reliability through transparent, reproducible comparison with domain experts.

## Methodology

### Phase 1: Curated Set Construction

**Selection Criteria:**
- 10-20 variants across 3-4 genes (diverse mechanisms)
- Mix of: loss-of-function, gain-of-function, benign VUS
- Public data only (ClinVar, literature)
- Structural coverage available

**Genes (Example):**
- BRCA1 (DNA repair, well-studied)
- CFTR (channelopathy, trafficking defects)
- TP53 (DNA binding, conformational)
- AR (ligand binding, allosteric)

### Phase 2: Expert Ground Truth

**Experts:**
- 2-3 structural biologists or clinical variant scientists
- Blind to VariantLens outputs

**Deliverable per Variant:**
- Mechanism hypothesis (2-3 sentences)
- Confidence level (high/moderate/low)
- Key structural features cited
- Uncertainty acknowledged

### Phase 3: Blind Generation

- VariantLens generates reports for full set
- No access to expert notes during generation
- Locked in versioned case files

### Phase 4: Comparison Rubric

| Dimension | Scale | Weight |
|-----------|-------|--------|
| Mechanism agreement | Full/Partial/None | 40% |
| Confidence calibration | Match/Over/Under | 30% |
| Citation relevance | Present/Absent/Irrelevant | 20% |
| Uncertainty acknowledgment | Yes/No | 10% |

### Phase 5: Public Documentation

**VALIDATION.md includes:**
- Full variant list with sources
- Expert notes (anonymized)
- Agent outputs
- Alignment scores per variant
- Aggregate statistics
- Error mode analysis

**No "Accuracy %" headline.** Instead:
> "VariantLens agent hypotheses aligned with expert assessments in X of Y cases, with Z partial agreements. Overconfidence detected in [specific contexts]."

## Continuous Validation

**Community Contribution Path:**
1. Submit variant + expert interpretation via PR
2. Review by maintainers for quality
3. Merge to validation set
4. Contributor credited in README

## Governance

- Validation set changes require PR review
- Version locked with releases
- Disagreements resolved by third expert adjudication
