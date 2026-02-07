# Release Notes

## v3.0.0-honest-pivot (Verified & Frozen)
**Date:** 2026-02-06
**Status:** PROD-READY (Research Use Only)

> **VariantLens v3.0.0 is a deterministic evidence briefing tool that aggregates and visualizes verifiable variant data with strict provenance and no interpretive claims.**

### 🚀 Key Features
*   **Interactive Structure Viewer:** Deterministic SIFTS-based mapping. Magenta highlight ONLY for strict UniProt-PDB matches. Explicit "UNMAPPED" banners for mapped structures with missing residues.
*   **Evidence Briefing:** Clean, table-based presentation of ClinVar, PubMed, and PDB data. Zero AI summarization or hallucination risk.
*   **Provenance Export:** Markdown exports include an "Evidence Stamp" with generation timestamp, exact query parameters, and IDs (ClinVar/PDB).
*   **Research Use Only:** Prominent disclaimers on UI and Exports.

### 🔒 Immutable Rules (Do Not Change)
1.  **No Interpretation:** The system never synthesizes conclusions or "likely" statuses.
2.  **No Inference Highlighting:** Structure highlighting occurs ONLY if SIFTS explicitly maps the residue.
3.  **Visible Limitations:** Gaps (unmapped residues, no papers) are explicitly shown, not hidden.
4.  **Transparent Queries:** Precise search terms sent to PubMed/APIs are visible to the user.

### 🐛 Verification
*   **Test Suite:** `src/validation/__tests__/phase3-verification.test.ts`
*   **Coverage:** Logic (HIGHLIGHT/SAFETY), Exports (STAMP/PROVENANCE), API (MOCK-FREE).
