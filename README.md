# <div align="center">VariantLens 🔭</div>

<div align="center">
  <h3>Structure-Aware Evidence Briefing for Genetic Variant Research</h3>
  
  <p>
    <a href="https://nextjs.org">
      <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
    </a>
    <a href="#">
      <img src="https://img.shields.io/badge/Status-Research_Only-yellow?style=for-the-badge" alt="Research Only" />
    </a>
  </p>
</div>

---

## ⚠️ Important Notice

**RESEARCH USE ONLY.** This tool provides evidence briefings for genetic variants. It does NOT provide:
- Clinical interpretation
- Pathogenicity prediction
- Diagnostic guidance
- Treatment recommendations

Always consult qualified professionals for clinical decisions.

---

## 🌌 Overview

**VariantLens** is a research tool that helps researchers quickly understand what is **known** — and **unknown** — about a genetic variant by aggregating structured evidence from curated databases.

### What It Does
- ✅ Extracts curated protein domains from UniProt
- ✅ Resolves 3D structures from PDB and AlphaFold
- ✅ Shows evidence coverage (structure, clinical, literature)
- ✅ **Explicitly lists what is NOT known**
- ✅ Generates AI summaries grounded in available data

### What It Does NOT Do
- ❌ Interpret clinical significance
- ❌ Predict pathogenicity or mechanism
- ❌ Replace expert analysis

---

## ✨ Key Features

### 📊 Evidence Coverage Panel
Shows at-a-glance what data is available:
- Structure (PDB/AlphaFold)
- Clinical annotation (ClinVar - planned)
- Domain annotation (UniProt)
- Variant-specific literature (planned)

### ⚠️ Evidence Limitations
**Shown FIRST, not hidden.** Missing data is explicitly flagged so researchers can assess reliability.

### 🧬 Curated Context
Domain and protein information extracted directly from UniProt — no LLM guessing.

### 📝 Evidence Summary
AI-generated summary that:
- Only describes available data
- Never infers mechanism or pathogenicity
- Always mentions at least one limitation

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- NVIDIA NIM API key (for LLM summaries)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SrikantShubam/Variant-lens.git
cd Variant-lens

# 2. Install dependencies
npm install

# 3. Configure Environment
cp .env.example .env.local
# Add your NVIDIA_API_KEY to .env.local

# 4. Start the development server
npm run dev
```

Visit `http://localhost:3000` and enter a variant (e.g. `JAK2:p.V617F`) to begin.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Data Sources**: UniProt, RCSB PDB, AlphaFold EBI
- **LLM**: NVIDIA NIM (meta/llama-3.3-70b-instruct)
- **Testing**: Jest + custom validation suite

---

## 📋 Validation

The tool includes a validation suite to ensure correctness:
- **Domain extraction** tested against known proteins
- **Position validation** rejects invalid positions
- **Regression tests** ensure limitations are never hidden

---

## 🤝 Contributing

We welcome contributions focused on:
- Improving data curation accuracy
- Adding new evidence sources
- Enhancing UI clarity

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with scientific rigor. Honest about what we don't know.</p>
  <p><strong>⚠️ Research Use Only ⚠️</strong></p>
</div>
