# Ethics & Compliance V2

## Data Policy

### Retention
- Case files: 30 days server-side
- Auto-deletion unless user exports
- User can request immediate deletion (email)
- Configurable in config.ts: `RETENTION_DAYS`

### Data Types Handled
- ✅ Public variant identifiers (HGVS)
- ✅ Public protein sequences (UniProt)
- ✅ Public structures (PDB/AlphaFold)
- ❌ Patient data (explicitly rejected)
- ❌ User personal information (minimal analytics only)

## Citation Integrity

### Agent Constraints
SYSTEM PROMPT ADDITION:
"You must not invent citations. If no direct evidence exists,
state: 'No direct literature found for this specific mechanism.'
All citations must include PMID or DOI."

### Validation
- Random audit: 10% of agent outputs checked against sources
- Community flagging: "Report incorrect citation" button
- Correction process: Issue → Fix → Release note

## Accessibility

### V2 Baseline (WCAG 2.1 AA Intent)
- Keyboard navigation for all inputs
- Alt text for structure images
- Color contrast ratios > 4.5:1
- Screen reader labels for viewer controls

### Mobile Safety
- Touch targets > 44px
- Viewer zoom controls (not just pinch)
- Fallback to static images on WebGL failure

## Medical Safety

### Explicit Disclaimers (UI)
- Header: "Research & Education Only"
- Report footer: "Not for clinical use. Not a diagnosis."
- Agent output: "Hypothesis, not fact."

### Risk Mitigation
- No pathogenicity scores
- No treatment suggestions
- No severity classifications beyond ClinVar lookup

## Compliance Checklist

- [ ] Privacy policy page (link in footer)
- [ ] Terms of service (no medical use clause)
- [ ] Cookie notice (if analytics used)
- [ ] Security headers (CSP for CDN assets)
- [ ] Dependency audit (no GPL conflicts for future commercial use)
