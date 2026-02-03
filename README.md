# <div align="center">VariantLens 🔭</div>

<div align="center">
  <h3>Next-Generation Genomic Analysis Powered by Recursive Agentic Reasoning</h3>
  
  <p>
    <a href="https://nextjs.org">
      <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
    </a>
    <a href="https://tailwindcss.com">
      <img src="https://img.shields.io/badge/Tailwind_CSS-Deep_Space-38bdf8?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-Strict-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
    </a>
    <a href="https://www.framer.com/motion/">
      <img src="https://img.shields.io/badge/Framer_Motion-Kinetic-0055ff?style=for-the-badge&logo=framer" alt="Framer Motion" />
    </a>
  </p>
</div>

---

## 🌌 Overview

**VariantLens** is a cutting-edge research tool that bridges the gap between raw genomic data and structural understanding. By combining real-time structure resolution (PDB/AlphaFold) with **recursive agentic reasoning**, it converts complex variant data (e.g., `BRCA1:p.Cys61Gly`) into interactive, cited, and visually stunning 3D explanations.

Designed with a **"Deep Space"** aesthetic, the UI features glassmorphism, bioluminescent accents, and kinetic typography to provide an immersive analysis experience worthy of modern scientific exploration.

## ✨ Key Features

### 🧬 Structural Intelligence
- **Dual-Engine Resolution**: Automatically resolves structures via **RCSB PDB** (experimental) with a seamless fallback to **AlphaFold** (predicted) for complete coverage.
- **Smart Mapping**: (Coming Soon) Intelligent mapping from Gene Names to UniProt Accessions.
- **Real-time Validation**: Checks structure resolution and sequence coverage instantly.

### 🤖 Agentic Reasoning core
- **Recursive Logic**: Agents don't just answer; they reason. They formulate hypotheses, search for structural evidence, and validate findings against established literature.
- **Citation-Backed**: Every insight is cross-referenced with PubMed citations.
- **Hallucination Checks**: built-in validation layer flags potential biological conflicts.

### 🎨 Awwwards-Caliber UI
- **Deep Space Theme**: A custom Tailwind configuration featuring "Bioluminescence" cyan (`#00f5d4`) and "Plasma" violet (`#7b2cbf`).
- **Kinetic Typography**: Smooth, physics-based text animations powered by Framer Motion.
- **Mesh Gradients**: Dynamic, living backgrounds that breathe with the application state.
- **Bento Grid Layout**: Data presented in a modern, asymmetric grid for optimal information density.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm / yarn / pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/SrikantShubam/Variant-lens.git

# 2. Enter the directory
cd Variant-lens

# 3. Install dependencies
npm install

# 4. Configure Environment
# Copy .env.example to .env.local and add your keys (OpenRouter/Google Gemini)
cp .env.example .env.local

# 5. Start the engine
npm run dev
```

Visit `http://localhost:3000` and enter a variant (e.g. `TP53:p.R175H`) to begin analysis.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Custom Design System
- **Animation**: Framer Motion
- **State**: React Hooks + Context
- **Testing**: Jest (Migration to Vitest planned)
- **Biology**: RCSB PDB API, AlphaFold API, Mol* (Planned)

## 🤝 Contributing

We welcome explorers!
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## ⚠️ Disclaimer

**Research Use Only.** VariantLens is an automated analysis tool. While it uses validated databases, its outputs should not be used as the sole basis for clinical diagnosis or treatment decisions. Always consult a qualified medical geneticist.

---

<div align="center">
  <p>Built with 🧪 scientific rigor and 💜 code.</p>
</div>
