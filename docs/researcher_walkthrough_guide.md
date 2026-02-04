# VariantLens Phase-1 Researcher Walkthrough Guide

## 🎯 Purpose
Validate that researchers understand and trust the evidence briefing approach.
**Goal:** 5-10 walkthroughs before any Phase-2 work.

---

## 📋 Pre-Walkthrough Setup

### Environment
- [ ] Dev server running (`npm run dev`)
- [ ] Browser at `http://localhost:3000`
- [ ] Screen recording enabled (optional)
- [ ] Notebook ready for observations

### Participant Criteria
Target researchers who:
- Work with genetic variants
- Have used variant annotation tools before
- Can spare 15-20 minutes

---

## 🎬 Demo Script (15 min)

### 1. Introduction (2 min)
> "This is VariantLens, a research tool that shows what's known and unknown about a genetic variant. I'd like you to explore it and share your honest reactions. There are no wrong answers."

**DO NOT SAY:**
- "AI-powered"
- "Interprets variants"
- "Predicts pathogenicity"

### 2. Free Exploration (5 min)
Give them a variant to try:
```
JAK2:p.V617F
```

**Watch silently for:**
- Where do they look first?
- Do they scroll immediately?
- Do they click anything?
- Do they read the disclaimer?

### 3. Guided Questions (5 min)

Ask in order:
1. **"What does this tool tell you about the variant?"**
   - Listen for: interpretation vs. evidence framing
   
2. **"What would you trust from this output?"**
   - Listen for: which sections they cite
   
3. **"What's missing that you expected?"**
   - Listen for: clinical, functional, literature expectations

4. **"Would you use this in your work?"**
   - Listen for: specific use cases

### 4. Edge Case Test (3 min)
Try a low-data variant:
```
OBSCN:p.R4831H
```

**Ask:**
- "What's different about this result?"
- "Do you trust this more or less?"

---

## 👁️ Observation Checklist

Rate each (1-5):

| Behavior | Rating | Notes |
|----------|--------|-------|
| Noticed research disclaimer | | |
| Read Evidence Limitations section | | |
| Understood domain annotation | | |
| Asked about clinical significance | | |
| Confused by any section | | |
| Over-trusted AI summary | | |
| Requested missing feature | | |

---

## 🚩 Red Flags to Watch For

### Critical (Stop and Note)
- ❌ "So this variant causes disease?"
- ❌ "This confirms my diagnosis"
- ❌ "The AI says it's pathogenic"
- ❌ Skipped disclaimer entirely

### Moderate (Note for Phase-2)
- ⚠️ "What does domain mean here?"
- ⚠️ "Where are the papers?"
- ⚠️ "Why no ACMG classification?"
- ⚠️ Expected 3D visualization

### Positive (Desired Responses)
- ✅ "I see there's no clinical data"
- ✅ "Good that it shows limitations"
- ✅ "This helps me know what to look up"
- ✅ "I'd use this as a starting point"

---

## 📝 Post-Walkthrough Questions

1. What was the most useful part?
2. What would make you NOT use this?
3. How does this compare to tools you use now?
4. What would you add first?
5. Any concerns about accuracy?

---

## 📊 Feedback Template

```markdown
## Researcher Walkthrough #[N]

**Date:** 
**Duration:** 
**Participant Background:**

### First Impressions
- 

### What They Trusted
- 

### What They Questioned
- 

### Missing Features Requested
- 

### Over-Trust Moments
- 

### Key Quote
> ""

### Recommendation for Phase-2
- 
```

---

## 🧪 Test Variants

| Variant | Expected Result | Purpose |
|---------|-----------------|---------|
| `JAK2:p.V617F` | Full data, kinase domain | Positive control |
| `BRAF:p.V600E` | Full data, kinase domain | Well-known variant |
| `TP53:p.R175H` | Full data, DNA-binding | Tumor suppressor |
| `OBSCN:p.R4831H` | No structure, no data | Negative control |
| `TP53:p.R500H` | INVALID (pos > length) | Error handling |

---

## 📈 Success Criteria

After 5+ walkthroughs, you should be able to answer:

1. **Do researchers understand this is NOT interpretation?**
2. **Do they see and read the limitations?**
3. **Do they trust it appropriately (not over/under)?**
4. **What's the #1 missing feature they want?**

---

## Next Steps After Walkthroughs

1. Compile feedback in `researcher_feedback.md`
2. Identify top 3 issues
3. Plan Phase-2 scope based on real needs
4. DO NOT add features speculatively
